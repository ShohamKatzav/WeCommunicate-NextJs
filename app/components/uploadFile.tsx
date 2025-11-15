'use client';
import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import Message from '@/types/message';
import { useUser } from '../hooks/useUser';
import { deleteFile } from '@/app/lib/fileActions'

import { MdDelete } from "react-icons/md";
import { AiOutlineFileAdd } from "react-icons/ai";
import useIsMobile from '../hooks/useIsMobile';

interface UploadFileProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
}

export default function UploadFile({ message, setMessage }: UploadFileProps) {

    const inputFileRef = useRef<HTMLInputElement>(null);
    const [blob, setBlob] = useState<PutBlobResult | null>(null);
    const { user } = useUser();
    const isMobile = useIsMobile();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const blobRef = useRef<PutBlobResult | null>(null);

    const deleteBlobFile = async () => {
        try {
            if (!(blobRef.current?.url)) return;
            await deleteFile(blobRef.current.url);
            setBlob(null);
            setMessage(prev => ({
                ...prev,
                file: undefined
            }));
        }
        catch {
            console.error('Failed to delete file');
        }
    }

    useEffect(() => {
        if (message.file === null) {
            setBlob(null);
            blobRef.current = null;
        }
    }, [message]);


    // This useEffect will clean files from vercel blob in 2 cases
    // 1) File uploaded but the user navigated away in the app
    // 2) File uploaded but the user navigated away outside the app
    useEffect(() => {
        // 2
        const deleteOnUnload = async (blobUrl?: string) => {
            if (!blobUrl) return;
            await deleteBlobFile();
        };

        const handleBeforeUnload = () => {
            const blob = blobRef.current;
            if (!blob) return;
            deleteOnUnload(blob.url);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);

            // Normal React unmount - 1
            const blob = blobRef.current;
            if (blob) {
                deleteBlobFile();
            }
        };
    }, []);

    useEffect(() => {
        if (!blob) return;
        blobRef.current = blob;
        setMessage(prev => ({
            ...prev,
            file:
            {
                contentType: blob.contentType,
                url: blob.url,
                downloadUrl: blob.downloadUrl,
                pathname: blob.pathname
            }
        }));
    }, [blob]);

    const handleSubmit = async () => {

        const blob = blobRef.current;
        if (blob) await deleteBlobFile();

        setError(null);

        if (!user?.token) {
            setError('User not authenticated');
            return;
        }

        if (!inputFileRef.current?.files || inputFileRef.current.files.length === 0) {
            setError('Please select a file');
            return;
        }

        const file = inputFileRef.current.files[0];
        // Optional: Validate file type and size
        const validTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
            'audio/mp3', 'audio/mpeg',
            'video/x-msvideo', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm',
            'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/pdf'
        ];
        if (!validTypes.includes(file.type)) {
            setError('Please select a valid file (JPEG, PNG, GIF, webp, mp3 or mpeg)');
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            setError('File size must be less than 10MB');
            return;
        }

        try {
            setIsUploading(true);
            const newBlob = await upload(file.name, file, {
                access: 'public',
                handleUploadUrl: '/api/send-file',
                headers: {
                    email: user.email!,
                    authorization: `Bearer ${user.token}`
                }
            });

            setBlob(newBlob);

            // Optional: Reset the form
            if (inputFileRef.current) {
                inputFileRef.current.value = '';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed');
            console.error(err);
        } finally {
            setIsUploading(false);
        }
    };

    if (!user) {
        return <div>Please log in to upload a file</div>;
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <label htmlFor="uploaded-file" className="cursor-pointer hover:opacity-80 transition-opacity">
                    <AiOutlineFileAdd size={isMobile ? 25 : 40} />
                </label>
                <input
                    id="uploaded-file"
                    className='hidden'
                    name="file"
                    ref={inputFileRef}
                    type="file"
                    accept="image/*,audio/*"
                    required
                    disabled={isUploading}
                    onChange={() => handleSubmit()}
                />
                <button
                    id="remove-file"
                    onClick={() => deleteBlobFile()}
                    disabled={!blob}
                    className="hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove file"
                >
                    <MdDelete size={isMobile ? 25 : 40} />
                </button>

                {/* Desktop: Inline filename */}
                {blob && !isMobile && (
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                        <span className="font-semibold">{blob.pathname}</span>
                    </span>
                )}
            </div>

            {/* Mobile: Filename below */}
            {blob && isMobile && (
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate max-w-[250px]">
                    File: <span className="font-semibold">{blob.pathname}</span>
                </div>
            )}

            {error && (
                <div role="alert" className="text-red-500 text-xs mt-1">
                    {error}
                </div>
            )}
        </>
    );
}