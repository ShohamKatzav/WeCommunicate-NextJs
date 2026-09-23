export interface IceServerConfig {
    urls: string | string[];
    username?: string;
    credential?: string;
}

const PUBLIC_STUN_SERVER = 'stun:stun.l.google.com:19302';

// Built on the server (see app/chat/page.tsx) because TURN credentials are
// server-only env vars. STUN alone connects most home and mobile networks;
// symmetric NATs and strict corporate networks need a TURN relay, which is
// opt-in: all three TURN_* vars set adds it, anything less and calls on those
// networks show the failed state instead. No public TURN relay is hardcoded.
export function getIceServers(): IceServerConfig[] {
    const servers: IceServerConfig[] = [{ urls: PUBLIC_STUN_SERVER }];

    const { TURN_URL, TURN_USERNAME, TURN_CREDENTIAL } = process.env;
    if (TURN_URL && TURN_USERNAME && TURN_CREDENTIAL) {
        servers.push({
            // Comma-separated, so one variable can list e.g. the udp and tcp
            // transports of the same relay.
            urls: TURN_URL.split(',').map(url => url.trim()).filter(Boolean),
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
        });
    }
    return servers;
}
