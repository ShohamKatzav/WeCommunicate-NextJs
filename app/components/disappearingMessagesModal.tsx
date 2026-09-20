import { useEffect, useState } from 'react';
import { X, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { DISAPPEARING_MESSAGES_OPTIONS } from '../config/limits';
import { getDisappearingMessagesSetting, setDisappearingMessages } from '../lib/conversationActions';

interface DisappearingMessagesModalProps {
    conversationId: string;
    onClose: () => void;
    // Lets the header's timer badge update immediately instead of waiting
    // for the next full page load to pick the new setting up.
    onSaved?: (seconds: number) => void;
}

export default function DisappearingMessagesModal({ conversationId, onClose, onSaved }: DisappearingMessagesModalProps) {
    const [selectedSeconds, setSelectedSeconds] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = await getDisappearingMessagesSetting(conversationId);
            if (!cancelled && result.success) {
                setSelectedSeconds(result.seconds);
            }
            if (!cancelled) setLoading(false);
        })();
        return () => { cancelled = true; };
    }, [conversationId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await setDisappearingMessages(conversationId, selectedSeconds);
            if (result.success) {
                onSaved?.(selectedSeconds);
                toast.success(
                    selectedSeconds === 0
                        ? 'Disappearing messages turned off'
                        : 'New messages in this chat will disappear automatically'
                );
                onClose();
            } else {
                toast.error(result.error || 'Failed to update setting');
            }
        } catch {
            toast.info("You're offline - this setting couldn't be saved right now.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                <Timer className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                Disappearing Messages
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            disabled={saving}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        New messages sent after you save this will be removed automatically. Messages already in this chat are not affected.
                    </p>

                    <div className="space-y-2 mb-6" role="radiogroup" aria-label="Disappearing messages duration">
                        {DISAPPEARING_MESSAGES_OPTIONS.map(option => (
                            <label
                                key={option.seconds}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                            >
                                <input
                                    type="radio"
                                    name="disappearing-messages-duration"
                                    checked={selectedSeconds === option.seconds}
                                    onChange={() => setSelectedSeconds(option.seconds)}
                                    disabled={loading || saving}
                                />
                                <span className="text-gray-900 dark:text-gray-100">{option.label}</span>
                            </label>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || saving}
                            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
