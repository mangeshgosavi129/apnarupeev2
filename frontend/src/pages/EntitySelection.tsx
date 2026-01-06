/**
 * Entity Selection Page
 * Premium landing page for selecting entity type
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Briefcase, Users, Building2, ArrowRight, Sparkles } from 'lucide-react';
import { useApplicationStore } from '@/stores/applicationStore';
import type { EntityType, CompanySubType } from '@/types';
import { ENTITY_CONFIG, COMPANY_SUBTYPE_CONFIG } from '@/types';

// Entity icons mapping
const entityIcons = {
    individual: User,
    proprietorship: Briefcase,
    partnership: Users,
    company: Building2,
};

export default function EntitySelection() {
    const navigate = useNavigate();
    const { entityType, setEntityType } = useApplicationStore();
    const [selectedEntity, setSelectedEntity] = useState<EntityType>(entityType);
    const [selectedSubType, setSelectedSubType] = useState<CompanySubType | null>(null);
    const [showSubTypes, setShowSubTypes] = useState(false);

    const handleEntitySelect = (type: EntityType) => {
        setSelectedEntity(type);
        if (type === 'company') {
            setShowSubTypes(true);
        } else {
            setShowSubTypes(false);
            setSelectedSubType(null);
        }
    };

    const handleContinue = () => {
        if (selectedEntity === 'company' && !selectedSubType) {
            setShowSubTypes(true);
            return;
        }
        setEntityType(selectedEntity, selectedSubType || undefined);
        navigate('/login');
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="py-6 px-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-display font-bold text-slate-900 dark:text-white">
                            Apna Rupee
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-4xl w-full">
                    {/* Title */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-12"
                    >
                        <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 dark:text-white mb-4">
                            Become a <span className="text-gradient">DSA Partner</span>
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                            Join our network of successful DSA partners. Fast, secure, and completely digital onboarding.
                        </p>
                    </motion.div>

                    {/* Entity Selection Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
                    >
                        {(Object.keys(ENTITY_CONFIG) as EntityType[]).map((type, index) => {
                            const config = ENTITY_CONFIG[type];
                            const Icon = entityIcons[type];
                            const isSelected = selectedEntity === type;

                            return (
                                <motion.button
                                    key={type}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 + index * 0.05 }}
                                    onClick={() => handleEntitySelect(type)}
                                    className={`
                    relative p-6 rounded-2xl text-left transition-all duration-300
                    ${isSelected
                                            ? 'glass-card ring-2 ring-primary-500 shadow-glow'
                                            : 'glass-card hover:shadow-lg'
                                        }
                  `}
                                >
                                    {/* Selected indicator */}
                                    {isSelected && (
                                        <motion.div
                                            layoutId="selected-indicator"
                                            className="absolute inset-0 rounded-2xl ring-2 ring-primary-500"
                                        />
                                    )}

                                    <div className="relative flex items-start gap-4">
                                        <div
                                            className={`
                        w-12 h-12 rounded-xl flex items-center justify-center
                        ${isSelected
                                                    ? `bg-gradient-to-br ${config.gradient} text-white`
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                }
                        transition-all duration-300
                      `}
                                        >
                                            <Icon className="w-6 h-6" />
                                        </div>

                                        <div className="flex-1">
                                            <h3
                                                className={`
                          font-semibold text-lg mb-1
                          ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-slate-900 dark:text-white'}
                        `}
                                            >
                                                {config.label}
                                            </h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                                {config.description}
                                            </p>
                                        </div>

                                        {/* Radio indicator */}
                                        <div
                                            className={`
                        w-5 h-5 rounded-full border-2 flex items-center justify-center
                        ${isSelected
                                                    ? 'border-primary-500 bg-primary-500'
                                                    : 'border-slate-300 dark:border-slate-600'
                                                }
                      `}
                                        >
                                            {isSelected && (
                                                <motion.div
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="w-2 h-2 rounded-full bg-white"
                                                />
                                            )}
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    {/* Company Sub-type Selection */}
                    {showSubTypes && selectedEntity === 'company' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-8"
                        >
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                                Select company type:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {(Object.keys(COMPANY_SUBTYPE_CONFIG) as CompanySubType[]).map((subType) => {
                                    const config = COMPANY_SUBTYPE_CONFIG[subType];
                                    const isSelected = selectedSubType === subType;

                                    return (
                                        <button
                                            key={subType}
                                            onClick={() => setSelectedSubType(subType)}
                                            className={`
                        p-4 rounded-xl text-left transition-all duration-200
                        ${isSelected
                                                    ? 'bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-500'
                                                    : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-primary-300'
                                                }
                      `}
                                        >
                                            <p className={`font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-900 dark:text-white'}`}>
                                                {config.label}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">{config.description}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    {/* Continue Button */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="flex justify-center"
                    >
                        <button
                            onClick={handleContinue}
                            disabled={selectedEntity === 'company' && !selectedSubType}
                            className="btn-primary flex items-center gap-2 text-lg px-8 py-4"
                        >
                            Continue
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </motion.div>

                    {/* Trust indicators */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-slate-500"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-success-500" />
                            100% Digital Process
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-success-500" />
                            Secure & Encrypted
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-success-500" />
                            RBI Compliant
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
