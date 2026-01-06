/**
 * References Step Component
 * Collect personal/professional references
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Plus,
    Trash2,
    Check,
    Loader2,
    ArrowRight,
    User,
    Phone,
    MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

interface ReferencesStepProps {
    onComplete: () => void;
}

interface Reference {
    name: string;
    mobile: string;
    email?: string;
    address: string;
}

export default function ReferencesStep({ onComplete }: ReferencesStepProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [references, setReferences] = useState<Reference[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editIndex, setEditIndex] = useState<number | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [mobile, setMobile] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');

    const MIN_REFERENCES = 2;

    useEffect(() => {
        loadReferences();
    }, []);

    const loadReferences = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/references');
            if (response.data.success) {
                setReferences(response.data.references);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to load references');
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setMobile('');
        setEmail('');
        setAddress('');
        setShowForm(false);
        setEditIndex(null);
    };

    const handleSubmit = async () => {
        if (!name || !mobile || !address) {
            toast.error('Please fill all required fields');
            return;
        }

        if (mobile.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        setIsLoading(true);
        try {
            if (editIndex !== null) {
                await api.put(`/references/${editIndex}`, { name, mobile, email, address });
                toast.success('Reference updated');
            } else {
                await api.post('/references', { name, mobile, email, address });
                toast.success('Reference added');
            }

            resetForm();
            await loadReferences();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to save reference');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (index: number) => {
        const ref = references[index];
        setName(ref.name);
        setMobile(ref.mobile);
        setEmail(ref.email || '');
        setAddress(ref.address);
        setEditIndex(index);
        setShowForm(true);
    };

    const handleDelete = async (index: number) => {
        if (!confirm('Remove this reference?')) return;

        setIsLoading(true);
        try {
            await api.delete(`/references/${index}`);
            toast.success('Reference removed');
            await loadReferences();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete');
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        try {
            const response = await api.post('/references/complete');
            if (response.data.success) {
                toast.success('References step completed!');
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
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                            References
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400">
                            Add at least {MIN_REFERENCES} personal or professional references
                        </p>
                    </div>
                </div>
            </div>

            {/* References List */}
            <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                        Your References ({references.length}/{MIN_REFERENCES} required)
                    </h3>
                    {!showForm && references.length < 5 && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-secondary flex items-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Add Reference
                        </button>
                    )}
                </div>

                {/* List */}
                <AnimatePresence>
                    {references.map((ref, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-3"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-slate-500" />
                                        <span className="font-medium">{ref.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                                        <Phone className="w-3 h-3" />
                                        <span>+91 {ref.mobile}</span>
                                    </div>
                                    <div className="flex items-start gap-2 text-sm text-slate-600">
                                        <MapPin className="w-3 h-3 mt-1" />
                                        <span className="line-clamp-2">{ref.address}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(index)}
                                        className="p-2 text-slate-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(index)}
                                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Empty state */}
                {references.length === 0 && !showForm && (
                    <div className="text-center py-8">
                        <p className="text-slate-500 mb-4">No references added yet</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Your First Reference
                        </button>
                    </div>
                )}

                {/* Add/Edit Form */}
                <AnimatePresence>
                    {showForm && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl"
                        >
                            <h4 className="font-medium mb-4">
                                {editIndex !== null ? 'Edit Reference' : 'Add New Reference'}
                            </h4>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Reference's full name"
                                        className="input-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Mobile Number *</label>
                                    <input
                                        type="tel"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                        placeholder="10-digit mobile"
                                        className="input-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email address"
                                        className="input-primary"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Address *</label>
                                    <textarea
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="Full address"
                                        rows={2}
                                        className="input-primary resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isLoading}
                                    className="btn-primary"
                                >
                                    {isLoading ? 'Saving...' : editIndex !== null ? 'Update' : 'Add Reference'}
                                </button>
                                <button onClick={resetForm} className="btn-ghost">
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Continue Button */}
            {references.length >= MIN_REFERENCES && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
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
            )}
        </div>
    );
}
