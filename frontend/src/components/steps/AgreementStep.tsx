/**
 * Agreement Step Component
 * PDF generation, E-Stamp, and E-Sign flow
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    FileText,
    Check,
    Loader2,
    Download,
    ExternalLink,
    Stamp,
    PenTool,
    PartyPopper,
    Eye,
    X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agreementApi, api } from '@/services/api';
import { useApplicationStore } from '@/stores/applicationStore';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

interface AgreementStepProps {
    onComplete: () => void;
}

type AgreementStatus = 'pending' | 'generated' | 'estamping' | 'estamped' | 'signing' | 'signed' | 'completed';

export default function AgreementStep({ onComplete }: AgreementStepProps) {
    const { setApplication } = useApplicationStore();
    const [isLoading, setIsLoading] = useState(false);
    const [loadingType, setLoadingType] = useState<'estamp' | 'esign' | 'generic'>('generic');
    const [loadingTitle, setLoadingTitle] = useState('Processing...');
    const [status, setStatus] = useState<AgreementStatus>('pending');
    const [signingUrl, setSigningUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

    // Fetch PDF with auth for preview
    const fetchPdfForPreview = async () => {
        try {
            const response = await agreementApi.download();
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfBlobUrl(url);
            setShowPreview(true);
        } catch (error) {
            toast.error('Failed to load agreement preview');
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            const response = await agreementApi.getStatus();
            if (response.data.success) {
                const s = response.data.status;

                if (s.complete) {
                    setStatus('completed');
                } else if (s.esignCompleted) {
                    setStatus('completed');
                } else if (s.esignId) {
                    // E-sign started but not verified/completed
                    setStatus('signing');
                    if (s.signingUrl) setSigningUrl(s.signingUrl);
                } else if (s.estampCompleted) {
                    setStatus('estamped');
                } else if (s.pdfGenerated) {
                    setStatus('generated');
                    // We don't have the URL handy here unless we call download, so we might need another way or just let user click generate again which should be idempotent-ish or instant
                    // But backend GET /status doesn't return the URL.
                    // We can assume download endpoint works.
                }
            }
        } catch (error) {
            console.error('Failed to check agreement status', error);
        }
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        try {
            const response = await agreementApi.generate();
            if (response.data.success) {
                setStatus('generated');
                toast.success('Agreement generated successfully!');
                fetchPdfForPreview(); // Auto-show preview after generation
                checkStatus();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate agreement');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            const response = await agreementApi.download();
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = 'DSA_Agreement.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            toast.success('Agreement downloaded successfully!');
        } catch (error) {
            toast.error('Failed to download agreement');
        }
    };

    const handleEStamp = async () => {
        setLoadingType('estamp');
        setLoadingTitle('Applying E-Stamp');
        setIsLoading(true);
        setStatus('estamping');
        try {
            const response = await agreementApi.estamp();
            if (response.data.success) {
                toast.success('E-stamp completed successfully!');
                setStatus('estamped');

                // Refresh global application store
                try {
                    const appResponse = await api.get('/application');
                    if (appResponse.data.success) {
                        setApplication(appResponse.data.application);
                    }
                } catch (e) {
                    console.log('Failed to refresh application store');
                }

                checkStatus();
            }
        } catch (error: any) {
            setStatus('generated'); // Revert
            toast.error(error.response?.data?.error || 'E-stamp failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleESign = async () => {
        setLoadingType('esign');
        setLoadingTitle('Initiating E-Sign');
        setIsLoading(true);
        setStatus('signing');
        try {
            const response = await agreementApi.esign();
            if (response.data.success) {
                setSigningUrl(response.data.signingUrl);
                toast.success('E-sign initiated. Please complete signing in the new window.');

                // Open signing URL in new window
                if (response.data.signingUrl) {
                    // We open the signing URL. 
                    // When done, it redirects to /agreement/callback which updates status.
                    window.location.href = response.data.signingUrl;
                }
            }
        } catch (error: any) {
            setStatus('estamped');
            toast.error(error.response?.data?.error || 'E-sign failed');
        } finally {
            setIsLoading(false);
        }
    };

    const checkEsignStatus = async () => {
        setIsLoading(true);
        await checkStatus();
        setIsLoading(false);
    };

    const handleComplete = async () => {
        // Just verify we are done and call onComplete
        if (status === 'completed') {
            onComplete();
        } else {
            checkStatus();
        }
    };

    const steps = [
        { id: 'generate', label: 'Generate Agreement', icon: FileText },
        { id: 'estamp', label: 'E-Stamp', icon: Stamp },
        { id: 'esign', label: 'E-Sign', icon: PenTool },
    ];

    const currentStepIndex =
        status === 'pending' ? 0 :
            status === 'generated' ? 1 :
                status === 'estamping' || status === 'estamped' ? 2 :
                    3;

    return (
        <>
            {/* Loading Overlay for E-Stamp/E-Sign */}
            <LoadingOverlay
                isVisible={isLoading && (status === 'estamping' || status === 'signing')}
                title={loadingTitle}
                type={loadingType}
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                                Agreement
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Generate, stamp, and sign your DSA agreement
                            </p>
                        </div>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-8">
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const isCompleted = index < currentStepIndex;
                            const isCurrent = index === currentStepIndex;

                            return (
                                <div key={step.id} className="flex flex-col items-center flex-1">
                                    <div className="flex items-center w-full">
                                        {/* Line before */}
                                        {index > 0 && (
                                            <div className={`h-1 flex-1 ${isCompleted ? 'bg-success-500' : 'bg-slate-200'}`} />
                                        )}

                                        {/* Icon */}
                                        <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${isCompleted ? 'bg-success-500 text-white' :
                                                isCurrent ? 'bg-primary-500 text-white ring-4 ring-primary-100' :
                                                    'bg-slate-200 text-slate-500'}
                  `}>
                                            {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                                        </div>

                                        {/* Line after */}
                                        {index < steps.length - 1 && (
                                            <div className={`h-1 flex-1 ${isCompleted ? 'bg-success-500' : 'bg-slate-200'}`} />
                                        )}
                                    </div>
                                    <span className={`text-sm mt-2 font-medium ${isCurrent ? 'text-primary-600' : 'text-slate-500'}`}>
                                        {step.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Action Area */}
                    {status === 'pending' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <p className="text-slate-600 mb-4">
                                Generate your DSA agreement based on your verified details
                            </p>
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="btn-primary"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    'Generate Agreement'
                                )}
                            </button>
                        </motion.div>
                    )}

                    {status === 'generated' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="flex items-center justify-center gap-2 text-success-600 mb-4">
                                <Check className="w-5 h-5" />
                                <span>Agreement generated</span>
                            </div>
                            <div className="flex items-center justify-center gap-4 mb-4">
                                <button
                                    onClick={() => fetchPdfForPreview()}
                                    className="inline-flex items-center gap-2 text-primary-600 hover:underline"
                                >
                                    <Eye className="w-4 h-4" />
                                    Preview Agreement
                                </button>
                                <button
                                    onClick={handleDownload}
                                    className="inline-flex items-center gap-2 text-primary-600 hover:underline"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Agreement
                                </button>
                            </div>

                            <div>
                                <button
                                    onClick={handleEStamp}
                                    disabled={isLoading}
                                    className="btn-primary"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Proceed to E-Stamp'
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {status === 'estamping' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
                            <p className="text-slate-600">Processing E-Stamp...</p>
                            <p className="text-sm text-slate-500">This may take a few moments</p>
                        </motion.div>
                    )}

                    {status === 'estamped' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <div className="flex items-center justify-center gap-2 text-success-600 mb-4">
                                <Check className="w-5 h-5" />
                                <span>E-Stamp completed</span>
                            </div>
                            <button
                                onClick={handleESign}
                                disabled={isLoading}
                                className="btn-primary"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Initiating...
                                    </>
                                ) : (
                                    'Proceed to E-Sign'
                                )}
                            </button>
                        </motion.div>
                    )}

                    {status === 'signing' && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                            <p className="text-slate-600 mb-4">
                                Complete your Aadhaar-based E-Sign in the opened window/tab
                            </p>
                            {signingUrl && (
                                <a
                                    href={signingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 btn-secondary mb-4"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Open Signing Page
                                </a>
                            )}
                            <div>
                                <button
                                    onClick={checkEsignStatus}
                                    disabled={isLoading}
                                    className="btn-primary"
                                >
                                    {isLoading ? 'Checking...' : 'Check Signing Status'}
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {status === 'completed' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-8"
                        >
                            <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <PartyPopper className="w-10 h-10 text-success-600" />
                            </div>
                            <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-2">
                                Congratulations!
                            </h3>
                            <p className="text-slate-600 mb-6">
                                Your DSA agreement has been successfully signed.
                            </p>
                            <button
                                onClick={handleComplete}
                                disabled={isLoading}
                                className="btn-primary"
                            >
                                {isLoading ? 'Finishing...' : 'Complete Onboarding'}
                            </button>
                        </motion.div>
                    )}
                </div>

                {/* PDF Preview Modal */}
                {showPreview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[90vw] h-[90vh] max-w-6xl flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    Agreement Preview
                                </h3>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleDownload}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                                    >
                                        <Download className="w-4 h-4" />
                                        Download
                                    </button>
                                    <button
                                        onClick={() => setShowPreview(false)}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                                    </button>
                                </div>
                            </div>

                            {/* PDF Viewer */}
                            <div className="flex-1 p-4">
                                {pdfBlobUrl ? (
                                    <iframe
                                        src={pdfBlobUrl}
                                        className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-700"
                                        title="Agreement Preview"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </>
    );
}
