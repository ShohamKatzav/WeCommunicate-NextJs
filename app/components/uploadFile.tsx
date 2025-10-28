'use client';

import { type PutBlobResult } from '@vercel/blob';
import { upload } from '@vercel/blob/client';
import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { useUser } from '../hooks/useUser';
import Message from '../types/message';
import AxiosWithAuth from '../utils/axiosWithAuth';

import { MdDelete } from "react-icons/md";
import { AiOutlineFileAdd } from "react-icons/ai";

interface UploadFileProps {
    message: Message;
    setMessage: Dispatch<SetStateAction<Message>>;
}

export default function UploadFile({ message, setMessage }: UploadFileProps) {

    const baseUrl = process.env.NEXT_PUBLIC_BASE_ADDRESS + "api/chat";

    const inputFileRef = useRef<HTMLInputElement>(null);
    const [blob, setBlob] = useState<PutBlobResult | null>(null);
    const { user } = useUser();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const blobRef = useRef<PutBlobResult | null>(null);

    const deleteBlobFile = async () => {
        try {
            await AxiosWithAuth().delete(`${baseUrl}/delete-file`,
                {
                    params: { url: blobRef.current?.url }
                });
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
        if (message.file === null)
            setBlob(null);
    }, [message]);


    // This useEffect will clean files from vercel blob in 2 cases
    // 1) Fill uploaded but the user navigated away in the app
    // 2) Fill uploaded but the user navigated away outside the app
    useEffect(() => {
        const deleteOnUnload = (blobUrl?: string) => {
            if (!blobUrl) return;
            if (navigator.sendBeacon) {
                const fd = new FormData();
                fd.append("url", blobUrl);
                navigator.sendBeacon(`${baseUrl}/delete-file-beacon`, fd);
            }
        };

        const handleBeforeUnload = () => {
            const blob = blobRef.current;
            if (!blob) return;
            deleteOnUnload(blob.url);
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            // Normal React unmount — use AxiosWithAuth for proper headers
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
            setError('Please select a valid file (JPEG, PNG, GIF, webp, mp3 or mpeg )');
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
                handleUploadUrl: '/api/chat/send-file',
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
        <div>
            <div className="flex flex-cols-2">
                <label htmlFor="uploaded-file">
                    <AiOutlineFileAdd size={40} />
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
                <label htmlFor="remove-file">
                    <MdDelete size={40} />
                </label>
                <button id="remove-file" onClick={() => deleteBlobFile()} disabled={!blob} />
            </div>

            <br />
            {blob && (
                <div>
                    File loaded:<br /><label>{blob.pathname}</label>
                </div>
            )}

            {error && (
                <div role="alert" style={{ color: 'red', marginTop: '1rem' }}>
                    {error}
                </div>
            )}

        </div>
    )
}