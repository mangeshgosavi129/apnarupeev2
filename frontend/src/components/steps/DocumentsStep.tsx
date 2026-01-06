/**
 * Documents Step Component
 * Upload required documents based on entity type
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    Upload,
    Check,
    Trash2,
    Loader2,
    ArrowRight,
    AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

interface DocumentsStepProps {
    onComplete: () => void;
}

interface RequiredDocument {
    type: string;
    label: string;
    description: string;
    required: boolean;
    uploaded: boolean;
}

export default function DocumentsStep({ onComplete }: DocumentsStepProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedType, setSelectedType] = useState<string | null>(null);

    useEffect(() => {
        loadRequiredDocuments();
    }, []);

    const loadRequiredDocuments = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/documents/required');
            if (response.data.success) {
                setRequiredDocs(response.data.documents);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to load documents');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectFile = (type: string) => {
        setSelectedType(type);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedType) return;

        // Validate file
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            toast.error('Only JPEG, PNG, and PDF files are allowed');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            return;
        }

        setUploading(selectedType);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('documentType', selectedType);

            const response = await api.post('/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data.success) {
                toast.success('Document uploaded');
                await loadRequiredDocuments();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Upload failed');
        } finally {
            setUploading(null);
            setSelectedType(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDelete = async (type: string) => {
        if (!confirm('Remove this document?')) return;

        setIsLoading(true);
        try {
            await api.delete(`/documents/${type}`);
            toast.success('Document removed');
            await loadRequiredDocuments();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete');
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            const response = await api.post('/documents/complete');
            if (response.data.success) {
                toast.success('Documents step completed!');
                onComplete();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to complete step');
        } finally {
            setIsLoading(false);
        }
    };

    const uploadedCount = requiredDocs.filter(d => d.uploaded).length;
    const requiredCount = requiredDocs.filter(d => d.required).length;
    const requiredMet = requiredDocs.filter(d => d.required && d.uploaded).length === requiredCount;

    return (
        <div className="space-y-6">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Header */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                            Document Upload
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Upload required documents for verification ({uploadedCount}/{requiredDocs.length})
                        </p>
                    </div>
                </div>
            </div>

            {/* Documents Grid */}
            <div className="glass-card p-6">
                <AnimatePresence>
                    {requiredDocs.map((doc, index) => (
                        <motion.div
                            key={doc.type}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                p-4 rounded-xl mb-3 border-2 transition-all
                ${doc.uploaded
                                    ? 'bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800'
                                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }
              `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{doc.label}</span>
                                        {doc.required && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{doc.description}</p>
                                </div>

                                <div className="flex items-center gap-2">
                                    {doc.uploaded ? (
                                        <>
                                            <div className="flex items-center gap-1 text-success-600">
                                                <Check className="w-5 h-5" />
                                                <span className="text-sm font-medium">Uploaded</span>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(doc.type)}
                                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => handleSelectFile(doc.type)}
                                            disabled={uploading === doc.type}
                                            className="btn-secondary flex items-center gap-2 text-sm"
                                        >
                                            {uploading === doc.type ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Uploading...
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-4 h-4" />
                                                    Upload
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Info */}
                <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0" />
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        <p className="font-medium mb-1">Accepted formats</p>
                        <p>JPEG, PNG, or PDF (max 10MB per file)</p>
                    </div>
                </div>
            </div>

            {/* Continue Button */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <button
                    onClick={handleComplete}
                    disabled={isLoading || !requiredMet}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {isLoading ? 'Please wait...' : 'Continue to Next Step'}
                    <ArrowRight className="w-5 h-5" />
                </button>
                {!requiredMet && (
                    <p className="text-center text-sm text-slate-500 mt-2">
                        Please upload all required documents to continue
                    </p>
                )}
            </motion.div>
        </div>
    );
}
