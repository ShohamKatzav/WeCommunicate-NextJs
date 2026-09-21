'use client';
import { createContext, Dispatch, ReactNode, RefObject, SetStateAction, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { File as FileIcon, FileAudio, FileText, FileVideo, Paperclip, X } from "lucide-react";
import Message from '@/types/message';
import { useUser } from '../hooks/useUser';
import { deleteFile } from '@/app/lib/fileActions'
import useIsMobile from '../hooks/useIsMobile';

interface UploadFileProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
    // Voice recording replaces the composer. The provider stays mounted so a
    // staged file is not thrown away just because the button unmounts; the
    // controls themselves hide until recording finishes.
    suspended?: boolean;
}

// Below this, whatever compression buys isn't worth the extra decode/encode
// work - a photo already this small is usually already-compressed or a
// screenshot, not a multi-MB camera photo.
const COMPRESSION_SKIP_THRESHOLD_BYTES = 200 * 1024;
// GIF/BMP are deliberately excluded - drawing a GIF onto a canvas only
// captures its first frame, silently destroying the animation.
const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

// Resizes and re-encodes an image client-side before it ever reaches blob
// storage - mobile camera photos are routinely 3-6000px and several MB,
// which costs real money against the free-tier blob storage/bandwidth quota.
// Falls back to the original file on any failure (unsupported browser,
// corrupted image, etc.) rather than blocking the send.
export async function compressImageIfWorthwhile(file: File): Promise<File> {
    if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type)) return file;
    if (file.size <= COMPRESSION_SKIP_THRESHOLD_BYTES) return file;
    if (typeof createImageBitmap !== 'function') return file;

    try {
        // 'from-image' bakes the file's EXIF rotation into the decoded
        // bitmap - canvas re-encoding otherwise strips EXIF entirely, which
        // is what makes portrait phone photos come out sideways.
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

        const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
        const targetWidth = Math.round(bitmap.width * scale);
        const targetHeight = Math.round(bitmap.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return file;
        }
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        bitmap.close();

        // PNG can carry transparency canvas would flatten to black if
        // re-encoded as JPEG, so only PNG stays PNG - everything else
        // (including WebP, which JPEG usually beats for compression here)
        // becomes JPEG.
        const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedBlob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? JPEG_QUALITY : undefined)
        );

        if (!compressedBlob || compressedBlob.size >= file.size) return file;

        const compressedName = outputType === file.type
            ? file.name
            : file.name.replace(/\.[^.]+$/, '') + '.jpg';

        return new File([compressedBlob], compressedName, { type: outputType });
    } catch (err) {
        console.error('Image compression failed, uploading original:', err);
        return file;
    }
}

const VALID_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'audio/mp3', 'audio/mpeg',
    'video/x-msvideo', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
];
const ACCEPT = VALID_TYPES.join(',');
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type DeleteFileResult = { error?: string };

function fileLabel(pathname?: string) {
    if (!pathname) return 'Attachment';
    const base = pathname.split('/').pop() || pathname;
    try {
        return decodeURIComponent(base);
    } catch {
        return base;
    }
}

function AttachmentIcon({ contentType }: { contentType?: string }) {
    const className = "text-gray-600 dark:text-gray-300";
    if (contentType?.startsWith('audio/')) return <FileAudio size={20} className={className} aria-hidden />;
    if (contentType?.startsWith('video/')) return <FileVideo size={20} className={className} aria-hidden />;
    if (contentType === 'application/pdf' || contentType?.includes('word') || contentType?.includes('excel') || contentType?.includes('spreadsheet')) {
        return <FileText size={20} className={className} aria-hidden />;
    }
    return <FileIcon size={20} className={className} aria-hidden />;
}

function FilePreview({ src, contentType }: { src?: string; contentType?: string }) {
    const [failed, setFailed] = useState(false);
    const showImage = !!src && !!contentType?.startsWith('image/') && !failed;

    return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-200 dark:bg-gray-600">
            {showImage ? (
                <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <AttachmentIcon contentType={contentType} />
            )}
        </div>
    );
}

type UploadFileContextValue = {
    suspended: boolean;
    isUploading: boolean;
    error: string | null;
    showChip: boolean;
    fileName: string;
    contentType?: string;
    previewSrc?: string;
    canRemove: boolean;
    canReplace: boolean;
    inputRef: RefObject<HTMLInputElement | null>;
    onFileChange: () => void;
    onRemove: () => void;
};

const UploadFileContext = createContext<UploadFileContextValue | null>(null);

function useUploadFile() {
    const value = useContext(UploadFileContext);
    if (!value) {
        throw new Error('Attach controls must be rendered inside UploadFileProvider');
    }
    return value;
}

export function UploadFileProvider({ message, setMessage, suspended = false, children }: UploadFileProps & { children: ReactNode }) {
    const { user } = useUser();
    const inputFileRef = useRef<HTMLInputElement>(null);
    const [blob, setBlob] = useState<PutBlobResult | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localName, setLocalName] = useState<string | null>(null);
    const [localType, setLocalType] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const blobRef = useRef<PutBlobResult | null>(null);
    const previewUrlRef = useRef<string | null>(null);
    const ownedUrlRef = useRef<string | null>(null);
    const messageFileUrlRef = useRef<string | undefined>(undefined);
    const generationRef = useRef(0);
    const mountedRef = useRef(true);
    const suspendedRef = useRef(suspended);
    const prevFileRef = useRef(message.file);

    messageFileUrlRef.current = message.file?.url;
    suspendedRef.current = suspended;

    const clearLocalFile = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current);
            previewUrlRef.current = null;
        }
        setPreviewUrl(null);
        setLocalName(null);
        setLocalType(null);
    }, []);

    // A normal send includes the staged file and then nulls it. A voice
    // message sends a different file and nulls this one while the recorder
    // still has the composer suspended - that blob was never attached to a
    // message, so it has to be deleted here or it is orphaned in storage.
    useEffect(() => {
        const previous = prevFileRef.current;
        prevFileRef.current = message.file;
        if (!previous?.url || message.file !== null) return;

        ownedUrlRef.current = null;
        blobRef.current = null;
        setBlob(null);
        clearLocalFile();
        if (suspendedRef.current) {
            void deleteFile(previous.url);
        }
    }, [message.file, clearLocalFile]);

    useEffect(() => {
        if (!blob) return;
        blobRef.current = blob;
        ownedUrlRef.current = blob.url;
        setMessage(prev => ({
            ...prev,
            file: {
                contentType: blob.contentType,
                url: blob.url,
                downloadUrl: blob.downloadUrl,
                pathname: blob.pathname
            }
        }));
    }, [blob, setMessage]);

    // Deletes a file this composer uploaded but never sent: leaving the
    // chat, or closing the tab. A file already cleared by send is not owned
    // anymore, so this does not remove a delivered attachment.
    useEffect(() => {
        mountedRef.current = true;
        const deleteOwned = () => {
            const url = ownedUrlRef.current;
            if (!url) return;
            void deleteFile(url);
        };
        window.addEventListener('beforeunload', deleteOwned);
        return () => {
            mountedRef.current = false;
            generationRef.current += 1;
            window.removeEventListener('beforeunload', deleteOwned);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
            deleteOwned();
        };
    }, []);

    const onRemove = useCallback(async () => {
        const url = ownedUrlRef.current || messageFileUrlRef.current;
        if (!url) return;
        try {
            const result = await deleteFile(url) as DeleteFileResult;
            if (result?.error) {
                console.error('Failed to delete file');
                setError("Couldn't remove that file. Try again.");
                return;
            }
        } catch {
            console.error('Failed to delete file');
            setError("Couldn't remove that file. Try again.");
            return;
        }

        generationRef.current += 1;
        ownedUrlRef.current = null;
        blobRef.current = null;
        setBlob(null);
        clearLocalFile();
        setError(null);
        setMessage(prev => ({ ...prev, file: undefined }));
    }, [clearLocalFile, setMessage]);

    const onFileChange = useCallback(async () => {
        setError(null);

        const input = inputFileRef.current;
        const selected = input?.files?.[0];
        if (input) input.value = '';

        if (!user?.token) {
            setError('User not authenticated');
            return;
        }
        if (!selected) {
            setError('Please select a file');
            return;
        }
        if (!VALID_TYPES.includes(selected.type)) {
            setError('Please select a supported image, audio, video, PDF, Word, or Excel file');
            return;
        }
        if (selected.size > MAX_FILE_BYTES) {
            setError('File size must be less than 10MB');
            return;
        }

        const generation = ++generationRef.current;
        const previousUrl = ownedUrlRef.current || messageFileUrlRef.current;
        ownedUrlRef.current = null;
        blobRef.current = null;
        setBlob(null);
        setLocalName(selected.name);
        setLocalType(selected.type);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        if (selected.type.startsWith('image/')) {
            const objectUrl = URL.createObjectURL(selected);
            previewUrlRef.current = objectUrl;
            setPreviewUrl(objectUrl);
        } else {
            previewUrlRef.current = null;
            setPreviewUrl(null);
        }
        setIsUploading(true);
        setMessage(prev => ({ ...prev, file: undefined }));
        if (previousUrl) void deleteFile(previousUrl);

        try {
            let file = selected;
            if (file.type.startsWith('image/')) {
                file = await compressImageIfWorthwhile(file);
            }
            if (!mountedRef.current || generationRef.current !== generation) return;
            setLocalType(file.type);
            // Swap the preview to the compressed image once it exists, so a
            // multi-megabyte camera photo isn't what the chip keeps decoded.
            if (file !== selected && file.type.startsWith('image/')) {
                if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
                const objectUrl = URL.createObjectURL(file);
                previewUrlRef.current = objectUrl;
                setPreviewUrl(objectUrl);
            }

            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/send-file',
                headers: {
                    email: user.email!,
                    authorization: `Bearer ${user.token}`
                }
            });

            if (!mountedRef.current || generationRef.current !== generation) {
                await deleteFile(newBlob.url);
                return;
            }

            ownedUrlRef.current = newBlob.url;
            blobRef.current = newBlob;
            setBlob(newBlob);
        } catch (err) {
            if (!mountedRef.current || generationRef.current !== generation) return;
            clearLocalFile();
            setError(err instanceof Error ? err.message : 'Upload failed');
            console.error('upload error detail', err);
        } finally {
            if (mountedRef.current && generationRef.current === generation) {
                setIsUploading(false);
            }
        }
    }, [user?.token, user?.email, setMessage, clearLocalFile]);

    const released = message.file === null && !isUploading;
    const staged = released ? null : (blob ?? (message.file?.url ? message.file : null));
    const contentType = localType || staged?.contentType;
    const previewSrc = previewUrl || (contentType?.startsWith('image/') ? staged?.url : undefined);
    const showChip = !released && (isUploading || !!localName || !!staged);

    const value = useMemo<UploadFileContextValue>(() => ({
        suspended,
        isUploading,
        error,
        showChip,
        fileName: localName || fileLabel(staged?.pathname),
        contentType,
        previewSrc,
        canRemove: !isUploading && !!staged?.url,
        canReplace: !!staged || isUploading,
        inputRef: inputFileRef,
        onFileChange: () => { void onFileChange(); },
        onRemove: () => { void onRemove(); },
    }), [suspended, isUploading, error, showChip, localName, staged, contentType, previewSrc, onFileChange, onRemove]);

    return (
        <UploadFileContext.Provider value={value}>
            {children}
        </UploadFileContext.Provider>
    );
}

export function UploadFileStatus() {
    const { suspended, isUploading, error, showChip, fileName, contentType, previewSrc, canRemove, onRemove } = useUploadFile();
    if (suspended || (!showChip && !error)) return null;

    return (
        <>
            {showChip && (
                <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border-l-4 border-green-500 bg-gray-100 px-3 py-2 dark:bg-gray-700">
                    <FilePreview key={previewSrc ?? contentType ?? 'file'} src={previewSrc} contentType={contentType} />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground" title={fileName}>
                            {fileName}
                        </div>
                        {isUploading && (
                            <div role="status" className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
                                Uploading…
                            </div>
                        )}
                    </div>
                    {canRemove && (
                        <button
                            type="button"
                            id="remove-file"
                            onClick={onRemove}
                            aria-label="Remove file"
                            className="shrink-0 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            )}
            {error && (
                <div role="alert" className="text-xs text-destructive">
                    {error}
                </div>
            )}
        </>
    );
}

export function UploadFileButton() {
    const { suspended, isUploading, canReplace, inputRef, onFileChange } = useUploadFile();
    const isMobile = useIsMobile();
    if (suspended) return null;

    return (
        <label
            aria-label={!isUploading && canReplace ? 'Replace file' : 'Attach file'}
            aria-disabled={isUploading}
            tabIndex={isUploading ? -1 : 0}
            onKeyDown={(e) => {
                if (isUploading) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                }
            }}
            onClick={(e) => {
                if (isUploading) e.preventDefault();
            }}
            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gray-100 p-2 transition-colors dark:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${isUploading ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
            <Paperclip size={isMobile ? 25 : 30} />
            <input
                id="uploaded-file"
                className="hidden"
                name="file"
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                disabled={isUploading}
                onChange={onFileChange}
            />
        </label>
    );
}