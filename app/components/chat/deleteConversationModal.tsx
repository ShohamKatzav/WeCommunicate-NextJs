import { X, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n/client';

interface DeleteConversationModalProps {
    isOpen: boolean;
    isDeleting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function DeleteConversationModal({
    isOpen,
    isDeleting,
    onClose,
    onConfirm
}: DeleteConversationModalProps) {
    const t = useT();
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full">
                <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {t("chat.deleteModal.title")}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label={t("common.close")}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            disabled={isDeleting}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-3 mb-6">
                        <p className="text-gray-700 dark:text-gray-300">
                            {t("chat.deleteModal.body")}
                        </p>

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                            <p className="text-sm text-amber-900 dark:text-amber-200 font-medium flex items-start gap-2">
                                <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</span>
                                <span>{t("chat.deleteModal.warning")}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t("chat.deleteModal.cancel")}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isDeleting}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    {t("chat.deleteModal.deleting")}
                                </>
                            ) : (
                                t("chat.deleteModal.delete")
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}