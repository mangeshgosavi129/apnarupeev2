/**
 * Bank Step Component
 * Bank account verification with IFSC lookup
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Building2,
    Check,
    Loader2,
    ArrowRight,
    AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { bankApi } from '@/services/api';
import { useApplicationStore } from '@/stores/applicationStore';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

interface BankStepProps {
    onComplete: () => void;
}

interface BankDetails {
    ifsc: string;
    bank: string;
    branch: string;
    address: string;
}

export default function BankStep({ onComplete }: BankStepProps) {
    const { application } = useApplicationStore();

    const [isLoading, setIsLoading] = useState(false);
    const [loadingTitle, setLoadingTitle] = useState('Processing...');
    const [ifsc, setIfsc] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
    const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
    const [verificationResult, setVerificationResult] = useState<any>(null);

    // Check if bank is already verified on mount
    useEffect(() => {
        if (application?.bank?.verified) {
            setVerificationResult({
                verified: true,
                flaggedForReview: application.bank.flaggedForReview,
                bank: {
                    bankName: application.bank.bankName,
                    accountHolderName: application.bank.accountHolderName,
                    accountNumber: application.bank.accountNumber,
                    ifsc: application.bank.ifsc,
                },
            });
        }
    }, [application?.bank]);

    // Verify IFSC
    const handleIfscLookup = async () => {
        if (ifsc.length !== 11) {
            toast.error('Please enter a valid 11-character IFSC code');
            return;
        }

        setLoadingTitle('Verifying IFSC');
        setIsLoading(true);
        try {
            const response = await bankApi.verifyIfsc(ifsc.toUpperCase());

            if (response.data.success) {
                setBankDetails({
                    ifsc: response.data.ifsc,
                    bank: response.data.bank,
                    branch: response.data.branch,
                    address: response.data.address,
                });
                toast.success('Bank details found!');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Invalid IFSC code');
            setBankDetails(null);
        } finally {
            setIsLoading(false);
        }
    };

    // Verify bank account
    const handleVerifyAccount = async () => {
        if (!bankDetails) {
            toast.error('Please verify IFSC code first');
            return;
        }

        if (accountNumber !== confirmAccountNumber) {
            toast.error('Account numbers do not match');
            return;
        }

        if (accountNumber.length < 8) {
            toast.error('Please enter a valid account number');
            return;
        }

        setLoadingTitle('Verifying Bank Account');
        setIsLoading(true);
        try {
            const response = await bankApi.verify(accountNumber, confirmAccountNumber, ifsc.toUpperCase());

            if (response.data.success) {
                setVerificationResult(response.data);

                if (response.data.verified) {
                    toast.success('Bank account verified!');
                } else if (response.data.flaggedForReview) {
                    toast.success('Bank verified but flagged for review');
                }
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Bank verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Complete bank step
    const handleComplete = async () => {
        setIsLoading(true);
        try {
            const response = await bankApi.complete();

            if (response.data.success) {
                toast.success('Bank step completed!');
                onComplete();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to complete step');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Loading Overlay for API calls */}
            <LoadingOverlay
                isVisible={isLoading}
                title={loadingTitle}
                type="bank"
            />

            <div className="space-y-6">
                {/* Header */}
                <div className="glass-card p-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                                Bank Verification
                            </h2>
                            <p className="text-slate-600 dark:text-slate-400">
                                Verify your bank account for commission payouts
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bank Form */}
                {!verificationResult?.verified ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6 space-y-6"
                    >
                        {/* IFSC Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                IFSC Code
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={ifsc}
                                    onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))}
                                    placeholder="e.g., SBIN0001234"
                                    className="input-primary flex-1 uppercase"
                                    maxLength={11}
                                />
                                <button
                                    onClick={handleIfscLookup}
                                    disabled={ifsc.length !== 11 || isLoading}
                                    className="btn-secondary"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
                                </button>
                            </div>
                        </div>

                        {/* Bank Details */}
                        {bankDetails && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="p-4 bg-success-50 dark:bg-success-900/20 rounded-xl"
                            >
                                <div className="flex items-center gap-2 text-success-700 dark:text-success-400 mb-2">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Bank Found</span>
                                </div>
                                <p className="font-semibold text-slate-900 dark:text-white">{bankDetails.bank}</p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">{bankDetails.branch}</p>
                            </motion.div>
                        )}

                        {/* Account Number */}
                        {bankDetails && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-4"
                            >
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        value={accountNumber}
                                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                                        placeholder="Enter account number"
                                        className="input-primary"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Confirm Account Number
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmAccountNumber}
                                        onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
                                        placeholder="Re-enter account number"
                                        className="input-primary"
                                    />
                                </div>

                                <button
                                    onClick={handleVerifyAccount}
                                    disabled={
                                        !accountNumber ||
                                        accountNumber !== confirmAccountNumber ||
                                        accountNumber.length < 8 ||
                                        isLoading
                                    }
                                    className="btn-primary w-full"
                                >
                                    {isLoading ? 'Verifying...' : 'Verify Account'}
                                </button>
                            </motion.div>
                        )}
                    </motion.div>
                ) : (
                    // Verification Complete
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
                                <Check className="w-8 h-8 text-success-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                                Bank Account Verified!
                            </h3>
                        </div>

                        {/* Bank Summary */}
                        <div className="space-y-3 mb-6">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-sm text-slate-500 mb-1">Bank</p>
                                <p className="font-semibold">{verificationResult.bank?.bankName}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-sm text-slate-500 mb-1">Account Holder</p>
                                <p className="font-semibold">{verificationResult.bank?.accountHolderName}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <p className="text-sm text-slate-500 mb-1">Account Number</p>
                                <p className="font-semibold font-mono">{verificationResult.bank?.accountNumber}</p>
                            </div>
                        </div>

                        {/* Name Match Warning */}
                        {verificationResult.flaggedForReview && (
                            <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl mb-6 flex gap-3">
                                <AlertTriangle className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-warning-700 dark:text-warning-400">Review Required</p>
                                    <p className="text-sm text-warning-600 dark:text-warning-500">
                                        Account holder name differs slightly from KYC name.
                                        This may require manual verification.
                                    </p>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleComplete}
                            disabled={isLoading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Please wait...' : 'Continue to Next Step'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </motion.div>
                )}
            </div>
        </>
    );
}
