import { Document, Schema, models, model } from 'mongoose';

export interface IFile extends Document {
    contentType: string;
    url: string;
    downloadUrl: string;
    pathname: string;
}

const FileSchema = new Schema<IFile>({
    contentType: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    downloadUrl: {
        type: String,
        required: true
    },
    pathname: {
        type: String,
        required: true
    },
});
export default models?.FileModel || model<IFile>('FileModel', FileSchema);