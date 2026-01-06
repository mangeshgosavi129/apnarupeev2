/**
 * Onboarding Page
 * Multi-step onboarding with step navigation and progress
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOut, Check, ChevronRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApplicationStore } from '@/stores/applicationStore';
import { useAuthStore } from '@/stores/authStore';
import { applicationApi, authApi } from '@/services/api';
import { ENTITY_CONFIG } from '@/types';
import type { StepConfig } from '@/types';

// Step Components (placeholders - will be built out)
import KycStep from '@/components/steps/KycStep';
import BankStep from '@/components/steps/BankStep';
import ReferencesStep from '@/components/steps/ReferencesStep';
import DocumentsStep from '@/components/steps/DocumentsStep';
import PartnersStep from '@/components/steps/PartnersStep';
import CompanyStep from '@/components/steps/CompanyStep';
import AgreementStep from '@/components/steps/AgreementStep';

export default function Onboarding() {
    const navigate = useNavigate();
    const { logout, user } = useAuthStore();
    const { application, entityType, setApplication, setSteps, steps, currentStep, setCurrentStep } = useApplicationStore();

    const [isLoading, setIsLoading] = useState(true);

    const entityConfig = ENTITY_CONFIG[entityType];

    // Load application and steps on mount
    useEffect(() => {
        loadApplicationData();
    }, []);

    const loadApplicationData = async () => {
        setIsLoading(true);
        try {
            // Get application
            const appResponse = await applicationApi.get();
            if (appResponse.data.success) {
                setApplication(appResponse.data.application);
            }

            // Get steps
            const stepsResponse = await applicationApi.getSteps();
            if (stepsResponse.data.success) {
                setSteps(stepsResponse.data.steps);
                setCurrentStep(stepsResponse.data.currentStep);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to load application');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (e) {
            // Ignore logout errors
        }
        logout();
        navigate('/');
    };

    const handleStepClick = (step: StepConfig) => {
        if (step.locked) {
            toast.error('Please complete previous steps first');
            return;
        }
        setCurrentStep(step.id);
    };

    const handleStepComplete = async () => {
        await loadApplicationData();
    };

    // Progress calculation
    const completedCount = steps.filter(s => s.completed).length;
    const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

    // Render current step component
    const renderStepContent = () => {
        if (!currentStep) return null;

        switch (currentStep) {
            case 'kyc':
            case 'pan':
                return <KycStep onComplete={handleStepComplete} />;
            case 'bank':
                return <BankStep onComplete={handleStepComplete} />;
            case 'references':
                return <ReferencesStep onComplete={handleStepComplete} />;
            case 'documents':
                return <DocumentsStep onComplete={handleStepComplete} />;
            case 'partners':
                return <PartnersStep onComplete={handleStepComplete} />;
            case 'company_verification':
            case 'directors':
                return <CompanyStep onComplete={handleStepComplete} />;
            case 'agreement':
                return <AgreementStep onComplete={handleStepComplete} />;
            default:
                return (
                    <div className="glass-card p-8 text-center">
                        <p className="text-slate-600">Unknown step "{currentStep}"</p>
                    </div>
                );
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-600">Loading your application...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${entityConfig.gradient} flex items-center justify-center`}>
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-lg font-display font-bold text-slate-900 dark:text-white">
                                DSA Onboarding
                            </span>
                            <p className="text-xs text-slate-500">{entityConfig.label}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            +91 {user?.phone}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex">
                {/* Sidebar - Steps */}
                <aside className="hidden lg:block w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6">
                    {/* Progress */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Progress
                            </span>
                            <span className="text-sm text-slate-500">
                                {completedCount}/{steps.length}
                            </span>
                        </div>
                        <div className="progress-bar">
                            <motion.div
                                className="progress-bar-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        </div>
                    </div>

                    {/* Steps List */}
                    <nav className="space-y-2">
                        {steps.map((step, index) => (
                            <button
                                key={step.id}
                                onClick={() => handleStepClick(step)}
                                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                  ${step.current
                                        ? 'bg-primary-50 dark:bg-primary-900/20'
                                        : step.completed
                                            ? 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                            : 'opacity-50 cursor-not-allowed'
                                    }
                `}
                            >
                                {/* Step indicator */}
                                <div
                                    className={`
                    step-indicator
                    ${step.completed ? 'completed' : step.current ? 'current' : 'pending'}
                  `}
                                >
                                    {step.completed ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>

                                {/* Step name */}
                                <span
                                    className={`
                    font-medium
                    ${step.current
                                            ? 'text-primary-700 dark:text-primary-300'
                                            : step.completed
                                                ? 'text-slate-900 dark:text-white'
                                                : 'text-slate-500'
                                        }
                  `}
                                >
                                    {step.name}
                                </span>

                                {step.current && (
                                    <ChevronRight className="w-4 h-4 ml-auto text-primary-500" />
                                )}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                        {/* Mobile Progress */}
                        <div className="lg:hidden mb-6">
                            <div className="flex items-center gap-4 mb-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Step {steps.findIndex(s => s.id === currentStep) + 1} of {steps.length}
                                </span>
                                <span className="text-sm text-primary-600 font-medium">
                                    {steps.find(s => s.id === currentStep)?.name}
                                </span>
                            </div>
                            <div className="progress-bar">
                                <motion.div
                                    className="progress-bar-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Step Content */}
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            {renderStepContent()}
                        </motion.div>
                    </div>
                </main>
            </div>
        </div>
    );
}
