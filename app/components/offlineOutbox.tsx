'use client';
import { useState } from 'react';
import { Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useOfflineOutbox, QueuedOperation } from '../hooks/useOfflineOutbox';

function describeOperation(item: QueuedOperation): string {
    switch (item.operation) {
        case 'saveMessage': {
            const text = item.data?.messageBody?.text;
            if (text) return `Message: "${text.length > 40 ? text.slice(0, 40) + '…' : text}"`;
            return item.data?.messageBody?.file ? 'Photo/file waiting to send' : 'Message waiting to send';
        }
        case 'deleteMessage':
            return 'Deleting a message';
        case 'deleteConversation':
            return 'Deleting a conversation';
        case 'cleanHistory':
            return 'Clearing chat history';
        default:
            return 'Pending action';
    }
}

// Makes the previously-invisible offline queue visible (see useOfflineOutbox)
// - a collapsed pill by default, expandable to see and manually retry what's
// actually queued.
export default function OfflineOutbox() {
    const { queue, retryNow } = useOfflineOutbox();
    const [expanded, setExpanded] = useState(false);

    if (queue.length === 0) return null;

    return (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 shrink-0">
            <button
                type="button"
                onClick={() => setExpanded(prev => !prev)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
            >
                <span className="flex items-center gap-2">
                    <Clock size={16} />
                    {queue.length} pending {queue.length === 1 ? 'item' : 'items'}
                    {" - will send when you're back online"}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded && (
                <div className="px-3 pb-2 space-y-1">
                    {queue.map(item => (
                        <div key={item.id} className="text-xs text-amber-700 dark:text-amber-300 truncate">
                            {describeOperation(item)}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={retryNow}
                        className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-100 hover:underline"
                    >
                        <RefreshCw size={14} /> Retry now
                    </button>
                </div>
            )}
        </div>
    );
}
