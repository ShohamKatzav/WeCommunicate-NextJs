'use client';
import { useState } from 'react';
import { Clock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useOfflineOutbox, QueuedOperation } from '../../hooks/useOfflineOutbox';
import { useT } from '../../i18n/client';
import type { TFunction } from '../../i18n/messages';

function describeOperation(item: QueuedOperation, t: TFunction): string {
    switch (item.operation) {
        case 'saveMessage': {
            const text = item.data?.messageBody?.text;
            if (text) return t('outbox.message', { text: text.length > 40 ? text.slice(0, 40) + '…' : text });
            return item.data?.messageBody?.file ? t('outbox.fileWaiting') : t('outbox.messageWaiting');
        }
        case 'deleteMessage':
            return t('outbox.deletingMessage');
        case 'deleteConversation':
            return t('outbox.deletingConversation');
        case 'cleanHistory':
            return t('outbox.clearingHistory');
        default:
            return t('outbox.pendingAction');
    }
}

// Makes the previously-invisible offline queue visible (see useOfflineOutbox)
// - a collapsed pill by default, expandable to see and manually retry what's
// actually queued.
export default function OfflineOutbox() {
    const { queue, retryNow } = useOfflineOutbox();
    const t = useT();
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
                    {t('outbox.pending', { count: queue.length })}
                    {t('outbox.willSend')}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {expanded && (
                <div className="px-3 pb-2 space-y-1">
                    {queue.map(item => (
                        <div key={item.id} className="text-xs text-amber-700 dark:text-amber-300 truncate">
                            {describeOperation(item, t)}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={retryNow}
                        className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-100 hover:underline"
                    >
                        <RefreshCw size={14} /> {t('outbox.retryNow')}
                    </button>
                </div>
            )}
        </div>
    );
}
