/**
 * Company Step Component
 * MCA verification for Company/LLP entities
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Building2,
    Check,
    Loader2,
    ArrowRight,
    Search,
    Users,
    Calendar,
    MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { useApplicationStore } from '@/stores/applicationStore';

interface CompanyStepProps {
    onComplete: () => void;
}

interface CompanyData {
    name: string;
    cin?: string;
    llpin?: string;
    status: string;
    registrationDate: string;
    registeredAddress?: string;
    directors: Array<{
        din: string;
        name: string;
        designation: string;
        kycCompleted: boolean;
    }>;
}

export default function CompanyStep({ onComplete }: CompanyStepProps) {
    const { application } = useApplicationStore();
    const [isLoading, setIsLoading] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [isVerified, setIsVerified] = useState(false);

    const isLLP = application?.companySubType === 'llp';
    const inputLabel = isLLP ? 'LLPIN' : 'CIN';
    const placeholder = isLLP ? 'e.g., AAA-1234' : 'e.g., U12345MH2020PTC123456';

    useEffect(() => {
        loadCompanyData();
    }, []);

    const loadCompanyData = async () => {
        try {
            const response = await api.get('/company');
            if (response.data.success && response.data.company) {
                setCompany(response.data.company);
                setIsVerified(true);
            }
        } catch (error) {
            // Company not verified yet - that's okay
        }
    };

    const handleVerify = async () => {
        if (!identifier) {
            toast.error(`Please enter a valid ${inputLabel}`);
            return;
        }

        setIsLoading(true);
        try {
            const payload = isLLP ? { llpin: identifier } : { cin: identifier };
            const response = await api.post('/company/verify', payload);

            if (response.data.success && response.data.verified) {
                setCompany(response.data.company);
                setIsVerified(true);
                toast.success('Company verified successfully!');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Verification failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            const response = await api.post('/company/complete');
            if (response.data.success) {
                toast.success('Company verification completed!');
                onComplete();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to complete step');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-card p-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                            Company Verification
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Verify your {isLLP ? 'LLP' : 'Company'} details via MCA
                        </p>
                    </div>
                </div>
            </div>

            {/* Verification Form */}
            {!isVerified ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-6"
                >
                    <h3 className="font-semibold mb-4">Enter {inputLabel}</h3>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                            placeholder={placeholder}
                            className="input-primary flex-1 uppercase"
                        />
                        <button
                            onClick={handleVerify}
                            disabled={!identifier || isLoading}
                            className="btn-primary flex items-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5" />
                                    Verify
                                </>
                            )}
                        </button>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                        Enter your {isLLP ? 'LLP Identification Number' : 'Corporate Identification Number'}
                    </p>
                </motion.div>
            ) : (
                <>
                    {/* Company Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-4 text-success-600">
                            <Check className="w-5 h-5" />
                            <span className="font-semibold">Company Verified</span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-sm text-slate-500">Company Name</p>
                                <p className="font-semibold text-lg">{company?.name}</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-slate-500">{isLLP ? 'LLPIN' : 'CIN'}</p>
                                    <p className="font-mono">{company?.cin || company?.llpin}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-slate-500">Status</p>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-sm ${company?.status === 'Active'
                                            ? 'bg-success-100 text-success-700'
                                            : 'bg-warning-100 text-warning-700'
                                        }`}>
                                        {company?.status}
                                    </span>
                                </div>
                            </div>

                            {company?.registrationDate && (
                                <div className="flex items-center gap-2 text-slate-600">
                                    <Calendar className="w-4 h-4" />
                                    <span>Incorporated: {company.registrationDate}</span>
                                </div>
                            )}

                            {company?.registeredAddress && (
                                <div className="flex items-start gap-2 text-slate-600">
                                    <MapPin className="w-4 h-4 mt-1" />
                                    <span className="text-sm">{company.registeredAddress}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Directors List */}
                    {company?.directors && company.directors.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass-card p-6"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-5 h-5 text-slate-600" />
                                <h3 className="font-semibold">Directors ({company.directors.length})</h3>
                            </div>

                            <div className="space-y-3">
                                {company.directors.map((director, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                                    >
                                        <div>
                                            <p className="font-medium">{director.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {director.designation} • DIN: {director.din}
                                            </p>
                                        </div>
                                        {director.kycCompleted ? (
                                            <span className="flex items-center gap-1 text-sm text-success-600">
                                                <Check className="w-4 h-4" />
                                                Verified
                                            </span>
                                        ) : (
                                            <span className="text-sm text-warning-600">KYC Pending</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Continue Button */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <button
                            onClick={handleComplete}
                            disabled={isLoading}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Please wait...' : 'Continue to Next Step'}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </motion.div>
                </>
            )}
        </div>
    );
}
