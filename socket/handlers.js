import RedisService from '@/services/RedisService';
import ModerationService from '@/services/ModerationService';
import { GetLocations, SaveLocations } from "@/app/lib/locationActions";
import Conversation from '@/models/Conversation'
import Message from '@/models/Message'
import Account from '@/models/Account'
import { sendPushToEmails } from '@/services/PushService';

async function isConversationMember(conversationId, email) {
    if (!conversationId || !email) return false;
    try {
        const conversation = await Conversation.findById(conversationId).populate('members', 'email');
        if (!conversation) return false;
        return conversation.members.some(member => member.email?.toLowerCase() === email.toLowerCase());
    } catch {
        return false;
    }
}

async function isModerator(email) {
    if (!email) return false;
    const account = await Account.findOne({ email }).select('isModerator').lean();
    return Boolean(account?.isModerator);
}

// Mirrors AccountRepository.isBlockedEitherWay (TypeScript, used by
// chatActions.saveMessage) - duplicated here rather than imported because
// this file works with models directly, not repositories, and the check is
// small. If either side has blocked the other, messaging between them stops.
async function isBlockedEitherWay(emailA, emailB) {
    if (!emailA || !emailB) return false;
    const [accountA, accountB] = await Promise.all([
        Account.findOne({ email: emailA }).select('_id blocked').lean(),
        Account.findOne({ email: emailB }).select('_id blocked').lean()
    ]);
    if (!accountA || !accountB) return false;
    const idA = accountA._id.toString();
    const idB = accountB._id.toString();
    const blockedByA = (accountA.blocked || []).some(id => id.toString() === idB);
    const blockedByB = (accountB.blocked || []).some(id => id.toString() === idA);
    return blockedByA || blockedByB;
}

export default async function handleSocketConnection(io, socket) {
    // The authenticated identity comes from authMiddleware, which verifies
    // the JWT - never from client-supplied handshake headers.
    const email = socket.data.email;

    try {
        // Register every listener before the first await below - the client
        // gets its connect ack (and can start emitting) as soon as the auth
        // middleware resolves, which races ahead of this handler if it awaits
        // anything first. A 'join room'/'message read' emitted in that window
        // previously arrived at a socket with no listener yet and was
        // silently dropped - this is what broke read receipts for a client
        // that reaches the chat page and opens a conversation quickly after
        // connecting (e.g. an already-authenticated session).
        socket.on('update connected users', () => {
            handleUpdateConnectedUsers(io);
            // The client sends this right after a block/unblock (see
            // chatClient.tsx's handleToggleBlock) - also the moment a call
            // between a now-blocked pair has to end.
            safely(() => handleCallBlockCheck(io, email));
        });
        socket.on('join room', (body) => handleJoinRoom(body, socket));
        socket.on('message read', (data) => handleMessageRead(io, socket, data));
        socket.on('publish message', (message) => handlePublishMessage(io, socket, message));
        socket.on('delete message', (message) => handleDeleteMessage(io, socket, message));
        socket.on('react to message', (data) => handleReactToMessage(io, socket, data));
        socket.on('notifications update', () => handleNotificationsUpdate(socket, email));
        socket.on("notifications checked", (roomID) => handleNotificationsChecked(roomID, email));
        socket.on('get locations', () => handleGetLocation(io, socket));
        socket.on('save location', (location) => handleSaveLocation(io, socket, location));
        socket.on('leave room', (body) => handleLeaveRoom(body, socket));
        socket.on('ban user', (data) => handleBanUser(io, socket, data));
        socket.on('unban user', (data) => handleUnbanUser(io, socket, data));
        socket.on('disconnect', () => {
            // A closed tab never sends its own 'stop typing'.
            stopAllTyping(socket);
            handleDisconnect(io, email, socket.id);
        });
        socket.on('start typing', (data) => handleStartTyping(socket, data));
        socket.on('stop typing', (data) => handleStopTyping(socket, data));
        socket.on('call invite', (data) => safely(() => handleCallInvite(io, socket, data)));
        socket.on('call accept', (data) => safely(() => handleCallAccept(io, socket, data)));
        socket.on('call decline', (data) => safely(() => handleCallDecline(io, socket, data)));
        socket.on('call cancel', (data) => safely(() => handleCallCancel(io, socket, data)));
        socket.on('call hangup', (data) => safely(() => handleCallHangup(io, socket, data)));
        socket.on('call signal', (data) => safely(() => handleCallSignal(io, socket, data)));
        socket.on('call sync', () => safely(() => handleCallSync(socket)));

        await RedisService.addUserSocket(email, socket.id);
        // Routed through the same per-viewer filtering as every other
        // presence update (see handleUpdateConnectedUsers) - a raw
        // io.emit here would leak a blocker's presence to this newly
        // connected socket even though every other update correctly hides it.
        await handleUpdateConnectedUsers(io);
    }
    catch (error) {
        console.error('Socket connection error:', error);
        socket.disconnect(true);
    }
}

async function handleJoinRoom(body, socket) {
    const conversationId = body?.conversationId;
    if (!conversationId) return;

    // Only members of the conversation may join its room - otherwise any
    // authenticated client could read/listen in on any conversation whose
    // ID it can guess or discover.
    if (!(await isConversationMember(conversationId, socket.data.email))) return;

    const room = `chat_room_${conversationId}`;
    socket.join(room);

    socket.to(room).emit('request typing status', {
        requestedBy: socket.id
    });
}

// Marks every not-yet-read message from other members as read, and tells
// the room so senders can update their own sent messages' status. In a
// group conversation this fires as soon as ANY other member has read a
// message, not "read by everyone" - a per-member "seen by" list is a
// bigger feature than this first pass covers.
async function handleMessageRead(io, socket, data) {
    const conversationId = data?.conversationId;
    const readerEmail = socket.data.email;
    if (!conversationId || !readerEmail) return;

    if (!(await isConversationMember(conversationId, readerEmail))) return;

    const result = await Message.updateMany(
        {
            conversation: conversationId,
            sender: { $ne: readerEmail },
            status: { $nin: ['read', 'revoked'] }
        },
        { $set: { status: 'read' } }
    );

    if (result.modifiedCount > 0) {
        const room = `chat_room_${conversationId}`;
        io.to(room).emit('messages read', { conversationId, readerEmail });
    }
}

// Presence is broadcast per-viewer, not as one global list to everyone -
// someone who has blocked you shouldn't reveal their online status to you
// (deliberately still one-directional: you blocking them doesn't hide your
// own presence from them, only theirs from you, matching how the message
// block itself already only rejects sends, not visibility of the blocker).
// One query for however many users are online, not one per viewer.
async function handleUpdateConnectedUsers(io) {
    const allOnline = await RedisService.getOnlineUsers();
    const sockets = await io.fetchSockets();
    if (sockets.length === 0) return;

    if (allOnline.length === 0) {
        sockets.forEach(s => s.emit('update connected users', allOnline));
        return;
    }

    const onlineEmails = allOnline.map(u => u.email);
    const accounts = await Account.find({ email: { $in: onlineEmails } })
        .select('email blocked')
        .lean();
    const emailById = new Map(
        accounts.flatMap(a => a.email ? [[a._id.toString(), a.email.toLowerCase()]] : [])
    );

    // targetEmail -> set of emails that have blocked them.
    const blockersOf = new Map();
    for (const account of accounts) {
        if (!account.email) continue;
        for (const blockedId of account.blocked || []) {
            const targetEmail = emailById.get(blockedId.toString());
            if (!targetEmail) continue; // the account they blocked isn't online right now
            if (!blockersOf.has(targetEmail)) blockersOf.set(targetEmail, new Set());
            blockersOf.get(targetEmail).add(account.email.toLowerCase());
        }
    }

    for (const s of sockets) {
        const viewerEmail = s.data.email?.toLowerCase();
        const blockers = viewerEmail ? blockersOf.get(viewerEmail) : undefined;
        const filtered = blockers
            ? allOnline.filter(u => !blockers.has(u.email?.toLowerCase()))
            : allOnline;
        s.emit('update connected users', filtered);
    }
}

async function handlePublishMessage(io, socket, message) {
    if (!message?.conversationID || !message?.sender) return;
    // The sender the message is published as must match the authenticated
    // caller - otherwise a client could spoof messages "from" anyone else.
    if (message.sender.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const room = `chat_room_${message.conversationID}`;
    const conversation = await Conversation.findById(message.conversationID).populate('members', 'email');
    if (!conversation) return;

    const isMember = conversation.members.some(
        member => member.email?.toLowerCase() === socket.data.email?.toLowerCase()
    );
    if (!isMember) return;

    // Real-time fan-out is the last line of defence against a client that
    // emits 'publish message' directly instead of going through the
    // saveMessage server action (which already rejects blocked 1:1 sends
    // before they're ever persisted) - defense in depth, not the primary
    // enforcement point. 1:1 only, same scope as saveMessage's own check.
    if (conversation.members.length === 2) {
        const otherMember = conversation.members.find(
            member => member.email?.toLowerCase() !== socket.data.email?.toLowerCase()
        );
        if (otherMember && await isBlockedEitherWay(message.sender, otherMember.email)) {
            return;
        }
    }

    for (const member of conversation.members) {
        // A member whose email was removed from the account can't be routed
        // by the email-keyed socket registry. Skip them instead of throwing,
        // so everyone else in the conversation still receives the message.
        if (!member.email) continue;
        if (member.email.toUpperCase() === message.sender.toUpperCase()) continue;

        const memberSocketIds = await RedisService.getUserSocketsByEmail(member.email);
        const roomSockets = await io.in(room).allSockets();
        const isAnySocketInRoom = memberSocketIds?.some(id => roomSockets.has(id));

        if (isAnySocketInRoom) {
            memberSocketIds.forEach(id => {
                socket.to(id).emit('publish message', message);
            });
        } else {
            await RedisService.incrNotification(member.email, message.conversationID, 1);
            const notifications = await RedisService.getNotifications(member.email);
            memberSocketIds.forEach(id => {
                socket.to(id).emit('publish message', message);
                socket.to(id).emit('notifications update', notifications);
            });
        }
    }
}

async function handleDeleteMessage(io, socket, message) {
    // The client's own stored copy of a message it just sent carries
    // `conversation` (the raw Mongoose field name, from the saveMessage
    // response) rather than `conversationID` (the client Message type) -
    // handlePublishMessage's payload corrects this before emitting, but
    // 'delete message' sends the bubble's own message object as-is. Fall
    // back to `conversation` the same way useMessageHandling.tsx already
    // does when building the publish payload.
    const conversationId = message?.conversationID || message?.conversation;
    if (!conversationId || !message?._id) return;

    // Only the message's actual sender may broadcast its deletion -
    // otherwise any client could make any message vanish for everyone.
    const messageDoc = await Message.findById(message._id).select('sender');
    if (!messageDoc || messageDoc.sender?.toLowerCase() !== socket.data.email?.toLowerCase()) return;

    const room = `chat_room_${conversationId}`;
    io.to(room).emit('delete message', message);

    const conversation = await Conversation.findById(conversationId).populate('members', 'email');
    if (conversation) {
        for (const member of conversation.members) {
            const memberSocketIds = await RedisService.getUserSocketsByEmail(member.email);
            const roomSockets = await io.in(room).allSockets();
            const isAnySocketInRoom = memberSocketIds?.some(id => roomSockets.has(id));
            if (!isAnySocketInRoom) {
                memberSocketIds.forEach(id => {
                    io.to(id).emit('delete message', message);
                });
            }
        }
    }
}

// The reaction itself was already persisted by the toggleMessageReaction
// server action before this fires - this only fans the change out to whoever
// has the conversation open. The reactions broadcast are re-read from the
// document rather than taken from the client payload, so a client can't
// announce reactions that were never stored.
async function handleReactToMessage(io, socket, data) {
    const messageId = data?.messageId;
    if (!messageId) return;

    const message = await Message.findById(messageId).select('conversation reactions').lean();
    if (!message) return;

    const conversationId = message.conversation.toString();
    if (!(await isConversationMember(conversationId, socket.data.email))) return;

    io.to(`chat_room_${conversationId}`).emit('message reactions', {
        messageId: message._id.toString(),
        conversationId,
        reactions: message.reactions || []
    });
}

// The conversations this socket has said it's typing in and not yet stopped.
// Tracked so a tab that closes (or leaves the room) mid-sentence gets its
// 'stop typing' sent for it - before, only the sender's own idle timer ever
// sent one, so a closed tab left "X is typing..." on screen for good.
function typingConversations(socket) {
    if (!socket.data.typingIn) socket.data.typingIn = new Set();
    return socket.data.typingIn;
}

function handleStartTyping(socket, data) {
    const conversationId = data?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    typingConversations(socket).add(conversationId);
    // Broadcast the authenticated caller's own identity, not whatever
    // email the client payload claims. conversationId lets receivers scope
    // the indicator to the conversation it belongs to.
    socket.to(`chat_room_${conversationId}`).emit("start typing", {
        email: socket.data.email,
        conversationId
    });
}

function handleStopTyping(socket, data) {
    const conversationId = data?.conversationId;
    if (typeof conversationId !== 'string' || !conversationId) return;
    announceStopTyping(socket, conversationId);
}

// nsp.to().except() rather than socket.to(): this also runs from the
// disconnect handler, after the socket itself has gone.
function announceStopTyping(socket, conversationId) {
    typingConversations(socket).delete(conversationId);
    socket.nsp.to(`chat_room_${conversationId}`).except(socket.id).emit("stop typing", {
        email: socket.data.email,
        conversationId
    });
}

function stopAllTyping(socket) {
    for (const conversationId of [...typingConversations(socket)]) {
        announceStopTyping(socket, conversationId);
    }
}

async function handleNotificationsUpdate(socket, email) {
    const notifications = await RedisService.getNotifications(email);
    socket.emit("notifications update", notifications);
}

async function handleNotificationsChecked(roomID, email) {
    await RedisService.clearNotification(email, roomID);
}

async function handleGetLocation(io, socket) {
    const positions = await GetLocations();
    io.to(socket.id).emit('get locations', positions);
}

async function handleSaveLocation(io, socket, location) {
    await SaveLocations(socket.data.email, location);
    await handleGetLocation(io, socket);
}

async function handleBanUser(io, socket, data) {
    const { userEmail, message } = data || {};
    const callerEmail = socket.data.email;
    if (!userEmail || !callerEmail) return;

    const isSelfReport = userEmail.toLowerCase() === callerEmail.toLowerCase();

    if (isSelfReport) {
        // A user's own client reporting that the moderation system just
        // auto-banned them for a message it rejected - confirm that's
        // actually true before broadcasting/disconnecting.
        const banStatus = await ModerationService.isUserBanned(socket.data.userId);
        if (!banStatus.isBanned) return;
    } else if (!(await isModerator(callerEmail))) {
        // Anyone banning someone else must be a moderator - otherwise this
        // is a way for any client to kick arbitrary users off the app.
        return;
    }

    io.emit('moderator_update_banned_user', { userEmail, message });
    const socketIds = await RedisService.getUserSocketsByEmail(userEmail);
    socketIds.forEach(socketId => {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket) {
            targetSocket.emit('banned', { message: message || 'Your account has been banned' });
            targetSocket.disconnect(true);
        }
    });

    await RedisService.clearAllNotifications(userEmail);
    for (const socketId of socketIds) {
        await RedisService.removeUserSocket(userEmail, socketId);
    }
}

async function handleUnbanUser(io, socket, data) {
    const { userEmail } = data || {};
    if (!userEmail) return;
    if (!(await isModerator(socket.data.email))) return;

    io.emit('moderator_update_unbanned_user', { userEmail });
}


async function handleLeaveRoom(body, socket) {
    const conversationId = body?.conversationId;
    // Leaving a conversation mid-sentence ends the indicator there, even if
    // the client's own 'stop typing' never arrives.
    if (typeof conversationId === 'string' && typingConversations(socket).has(conversationId)) {
        announceStopTyping(socket, conversationId);
    }
    socket.leave(`chat_room_${conversationId}`);
}

async function handleDisconnect(io, email, socketId) {
    handleCallSocketDisconnect(io, email, socketId);
    await RedisService.removeUserSocket(email, socketId);

    // Only when the last socket for this account goes away - closing one of
    // several open tabs (or a reconnect) isn't leaving, and stamping a last
    // seen then would make someone who is plainly still online look gone.
    const remainingSockets = await RedisService.getUserSocketsByEmail(email);
    if (remainingSockets.length === 0) {
        await recordLastSeen(io, email);
    }

    await handleUpdateConnectedUsers(io);
}

// Stored on the account, then pushed to everyone already looking at a users
// list or chat header so it appears without a refresh. Held back from anyone
// this user has blocked, mirroring how handleUpdateConnectedUsers already
// hides a blocker's presence from the person they blocked - "last seen 2
// minutes ago" is the same information presence is.
async function recordLastSeen(io, email) {
    if (!email) return;

    const lastSeen = new Date();
    const account = await Account.findOneAndUpdate(
        { email },
        { $set: { lastSeen } }
    ).select('_id blocked').lean();
    if (!account) return;

    const blockedAccounts = (account.blocked || []).length
        ? await Account.find({ _id: { $in: account.blocked } }).select('email').lean()
        : [];
    const hiddenFrom = new Set(
        blockedAccounts.flatMap(blocked => blocked.email ? [blocked.email.toLowerCase()] : [])
    );

    const sockets = await io.fetchSockets();
    for (const s of sockets) {
        const viewerEmail = s.data.email?.toLowerCase();
        if (viewerEmail && hiddenFrom.has(viewerEmail)) continue;
        s.emit('user last seen', { email, lastSeen: lastSeen.toISOString() });
    }
}

// ---------------------------------------------------------------------------
// 1:1 calls - WebRTC signaling relay
//
// Audio and video go peer to peer. This server only relays the small SDP and
// ICE messages two browsers need to find each other, plus the ringing state
// around them. Calls live in memory on this process, keyed by account email
// (one call per account), because a call only exists while both sockets do:
// there's no call history, and nothing here is worth persisting.
//
// A call is bound to one socket per side (the caller's, and whichever of the
// callee's tabs answered), and everything after the answer is relayed to that
// exact socket. The invite itself goes to every socket the callee has, not
// only ones in chat_room_<id>: someone in a different conversation, or on the
// chat list, hasn't joined that room but still has to see the call ringing.
// ---------------------------------------------------------------------------

const activeCalls = new Map(); // lowercased email -> call (both sides share one record)

const CALL_RING_TIMEOUT_MS = 30 * 1000;
// Long enough for connectionStateRecovery to bring a socket back after a
// network blip (it keeps the same socket id), short enough that a closed tab
// ends the call for the other side quickly.
const CALL_DISCONNECT_GRACE_MS = 10 * 1000;
// A call normally trickles a few dozen candidates and a handful of offers
// (one per camera toggle) - the caps only stop a misbehaving client from
// flooding its peer.
const CALL_MAX_CANDIDATES = 300;
const CALL_MAX_DESCRIPTIONS = 100;
const CALL_MAX_SDP_LENGTH = 32 * 1024;
const CALL_MAX_CANDIDATE_LENGTH = 1024;
const CALL_PUSHES_PER_WINDOW = 10;
const CALL_PUSH_WINDOW_SECONDS = 10 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

// Call handlers run on every signal, so a rejected Redis/Mongo promise here
// must never become an unhandled rejection that takes the process down.
// Only the message is logged - a stack or payload could carry SDP. fn runs
// synchronously up to its first await, which the busy check in
// handleCallInvite relies on.
function safely(fn) {
    const logError = error => console.error('Call signaling error:', error?.message);
    try {
        Promise.resolve(fn()).catch(logError);
    } catch (error) {
        logError(error);
    }
}

function normalizeEmail(email) {
    return typeof email === 'string' ? email.toLowerCase() : '';
}

function parseCallIds(data) {
    const callId = data?.callId;
    const conversationId = data?.conversationId;
    if (typeof callId !== 'string' || !UUID_PATTERN.test(callId)) return null;
    if (typeof conversationId !== 'string' || !OBJECT_ID_PATTERN.test(conversationId)) return null;
    return { callId, conversationId };
}

// The sender's call, only when the event names that exact call - a stale
// event from a previous call (or a guessed id) never touches the current one.
function findCall(email, ids) {
    const call = activeCalls.get(email);
    if (!call || call.callId !== ids.callId || call.conversationId !== ids.conversationId) return null;
    return call;
}

function isBoundSocket(call, email, socketId) {
    return email === call.caller
        ? call.callerSocketId === socketId
        : call.calleeSocketId === socketId;
}

function peerSocketId(call, email) {
    return email === call.caller ? call.calleeSocketId : call.callerSocketId;
}

// The other member's email, only when `email` is a member of a conversation
// with exactly two members - v1 calls are 1:1 only.
async function getOneToOnePeerEmail(conversationId, email) {
    try {
        const conversation = await Conversation.findById(conversationId).populate('members', 'email');
        if (!conversation || conversation.members.length !== 2) return null;
        if (!conversation.members.some(member => normalizeEmail(member.email) === email)) return null;
        const other = conversation.members.find(member => normalizeEmail(member.email) !== email);
        return other?.email ? normalizeEmail(other.email) : null;
    } catch {
        return null;
    }
}

function clearCall(call) {
    call.ended = true;
    clearTimeout(call.ringTimer);
    for (const email of [call.caller, call.callee]) {
        if (activeCalls.get(email) === call) activeCalls.delete(email);
    }
}

// The Redis registry can outlive the sockets it lists (a server restart
// never runs their disconnect handlers), so "is the callee reachable" is
// answered from the sockets this process actually holds.
async function getLiveSocketIds(io, email) {
    const socketIds = await RedisService.getUserSocketsByEmail(email);
    return socketIds.filter(id => io.sockets.sockets.has(id));
}

async function emitToCalleeSockets(io, call, event, payload, exceptSocketId) {
    const socketIds = (await getLiveSocketIds(io, call.callee))
        .filter(id => id !== exceptSocketId);
    if (socketIds.length > 0) io.to(socketIds).emit(event, payload);
}

// Server-side end (block, a socket that never came back, a replaced call) -
// tells both sides. clearCall runs before the first await so nothing else
// can act on this call in the meantime.
async function endCall(io, call, reason) {
    if (call.ended) return;
    const wasRinging = call.state === 'ringing';
    clearCall(call);
    const payload = { callId: call.callId, conversationId: call.conversationId, reason };
    io.to(call.callerSocketId).emit('call hangup', payload);
    if (wasRinging) {
        await emitToCalleeSockets(io, call, 'call cancel', payload);
    } else {
        io.to(call.calleeSocketId).emit('call hangup', payload);
    }
}

function inviteFor(call) {
    return {
        callId: call.callId,
        conversationId: call.conversationId,
        video: call.video,
        from: call.caller
    };
}

async function handleCallInvite(io, socket, data) {
    const ids = parseCallIds(data);
    if (!ids || typeof data.video !== 'boolean') return;
    const email = normalizeEmail(socket.data.email);

    const peerEmail = await getOneToOnePeerEmail(ids.conversationId, email);
    if (!peerEmail) return;
    if (await isBlockedEitherWay(email, peerEmail)) {
        // Same neutral wording as a blocked message - never "you're blocked".
        socket.emit('call unavailable', { ...ids, reason: 'unavailable' });
        return;
    }

    // No awaits from here until the record is in the Map, so two invites
    // racing each other can't both pass the busy check.
    const existing = activeCalls.get(email);
    if (existing) {
        if (existing.callId === ids.callId) return;
        // One call at a time: starting a new one ends whatever this account
        // was already in (the client hangs up first too - this covers a
        // second tab, or a hangup that never arrived).
        safely(() => endCall(io, existing, 'replaced'));
    }
    if (activeCalls.has(peerEmail)) {
        socket.emit('call busy', ids);
        return;
    }

    const call = {
        ...ids,
        caller: email,
        callee: peerEmail,
        callerSocketId: socket.id,
        calleeSocketId: null,
        state: 'ringing',
        video: data.video,
        candidates: 0,
        descriptions: 0,
        calleeWasReachable: false,
        ringTimer: null,
        ended: false
    };
    activeCalls.set(email, call);
    activeCalls.set(peerEmail, call);
    call.ringTimer = setTimeout(() => safely(() => handleCallRingTimeout(io, call)), CALL_RING_TIMEOUT_MS);

    const calleeSockets = await getLiveSocketIds(io, peerEmail);
    if (call.ended) return;
    if (calleeSockets.length > 0) {
        call.calleeWasReachable = true;
        io.to(calleeSockets).emit('call invite', inviteFor(call));
    } else {
        await notifyOfflineCallee(call);
    }
}

// A push can't carry the call - it only gets the callee to open the app,
// where 'call sync' picks up the invite if it's still ringing.
async function notifyOfflineCallee(call) {
    const allowed = await RedisService.checkRateLimit(
        'call-push', call.caller, CALL_PUSHES_PER_WINDOW, CALL_PUSH_WINDOW_SECONDS
    );
    if (!allowed) return;
    const caller = await Account.findOne({ email: call.caller }).select('nickname').lean();
    const callerName = caller?.nickname || call.caller.split('@')[0];
    await sendPushToEmails([call.callee], {
        title: call.video ? 'Incoming video call' : 'Incoming voice call',
        body: `${callerName} is calling you on WeCommunicate. Open the app to answer.`
    });
}

async function handleCallRingTimeout(io, call) {
    if (call.ended || call.state !== 'ringing') return;
    clearCall(call);
    const ids = { callId: call.callId, conversationId: call.conversationId };
    io.to(call.callerSocketId).emit('call unavailable', {
        ...ids,
        reason: call.calleeWasReachable ? 'no-answer' : 'offline'
    });
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'missed' });
}

async function handleCallAccept(io, socket, data) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'ringing' || call.callee !== email) return;

    if (await isBlockedEitherWay(call.caller, call.callee)) {
        await endCall(io, call, 'ended');
        return;
    }
    // Another tab answered, or the caller cancelled, during that await.
    if (call.ended || call.state !== 'ringing') return;

    clearTimeout(call.ringTimer);
    call.state = 'active';
    call.calleeSocketId = socket.id;
    io.to(call.callerSocketId).emit('call accept', ids);
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'answered-elsewhere' }, socket.id);
}

async function handleCallDecline(io, socket, data) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'ringing' || call.callee !== email) return;

    clearCall(call);
    io.to(call.callerSocketId).emit('call decline', ids);
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'declined-elsewhere' }, socket.id);
}

async function handleCallCancel(io, socket, data) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'ringing' || call.caller !== email || call.callerSocketId !== socket.id) return;

    clearCall(call);
    await emitToCalleeSockets(io, call, 'call cancel', { ...ids, reason: 'cancelled' });
}

async function handleCallHangup(io, socket, data) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call) return;

    // Hanging up before an answer is a cancel (caller) or a decline (callee).
    if (call.state === 'ringing') {
        if (email === call.caller) await handleCallCancel(io, socket, data);
        else await handleCallDecline(io, socket, data);
        return;
    }
    if (!isBoundSocket(call, email, socket.id)) return;

    clearCall(call);
    // 'failed' lets the other side offer a retry too, instead of a plain
    // "call ended" for a call that never managed to connect. Nothing else
    // from the client is passed through.
    const reason = data.reason === 'failed' ? 'failed' : 'hangup';
    io.to(peerSocketId(call, email)).emit('call hangup', { ...ids, reason });
}

function sanitizeDescription(description) {
    if (!description || typeof description !== 'object') return null;
    const { type, sdp } = description;
    if (type !== 'offer' && type !== 'answer') return null;
    if (typeof sdp !== 'string' || sdp.length === 0 || sdp.length > CALL_MAX_SDP_LENGTH) return null;
    return { type, sdp };
}

function sanitizeCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const { candidate: line, sdpMid, sdpMLineIndex, usernameFragment } = candidate;
    if (typeof line !== 'string' || line.length > CALL_MAX_CANDIDATE_LENGTH) return null;
    if (sdpMid != null && (typeof sdpMid !== 'string' || sdpMid.length > 64)) return null;
    if (sdpMLineIndex != null && (!Number.isInteger(sdpMLineIndex) || sdpMLineIndex < 0 || sdpMLineIndex > 64)) return null;
    if (usernameFragment != null && (typeof usernameFragment !== 'string' || usernameFragment.length > 256)) return null;
    return {
        candidate: line,
        sdpMid: sdpMid ?? null,
        sdpMLineIndex: sdpMLineIndex ?? null,
        ...(usernameFragment != null ? { usernameFragment } : {})
    };
}

// SDP and candidates are never logged - they carry the peers' IP addresses.
function handleCallSignal(io, socket, data) {
    const ids = parseCallIds(data);
    if (!ids) return;
    const email = normalizeEmail(socket.data.email);
    const call = findCall(email, ids);
    if (!call || call.state !== 'active' || !isBoundSocket(call, email, socket.id)) return;

    const relay = { ...ids };
    if (data.description != null) {
        const description = sanitizeDescription(data.description);
        if (!description || ++call.descriptions > CALL_MAX_DESCRIPTIONS) return;
        relay.description = description;
    } else if (data.candidate != null) {
        const candidate = sanitizeCandidate(data.candidate);
        if (!candidate || ++call.candidates > CALL_MAX_CANDIDATES) return;
        relay.candidate = candidate;
    } else {
        return;
    }
    io.to(peerSocketId(call, email)).emit('call signal', relay);
}

// A tab that opens the chat while a call to this account is still ringing -
// typically from the call push above, or a reload - asks for the invite it
// missed.
function handleCallSync(socket) {
    const email = normalizeEmail(socket.data.email);
    const call = activeCalls.get(email);
    if (!call || call.state !== 'ringing' || call.callee !== email) return;
    call.calleeWasReachable = true;
    socket.emit('call invite', inviteFor(call));
}

// Only the socket a call is bound to matters - the call's media lives in
// that tab, so another tab of the same account staying open doesn't keep it
// alive. A ringing callee isn't bound yet; ringing just continues on any
// other tab until the timeout.
function handleCallSocketDisconnect(io, email, socketId) {
    const normalized = normalizeEmail(email);
    const call = activeCalls.get(normalized);
    if (!call || !isBoundSocket(call, normalized, socketId)) return;

    setTimeout(() => {
        // connectionStateRecovery restores the same socket id after a blip.
        if (call.ended || io.sockets.sockets.has(socketId)) return;
        safely(() => endCall(io, call, 'disconnected'));
    }, CALL_DISCONNECT_GRACE_MS);
}

async function handleCallBlockCheck(io, email) {
    const call = activeCalls.get(normalizeEmail(email));
    if (!call) return;
    if (await isBlockedEitherWay(call.caller, call.callee)) {
        // 'ended', not 'blocked' - the other side isn't told why.
        await endCall(io, call, 'ended');
    }
}
