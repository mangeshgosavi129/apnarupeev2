/**
 * Application Store
 * Manages onboarding application state
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Application, EntityType, CompanySubType, StepConfig } from '@/types';

interface ApplicationState {
    // State
    application: Application | null;
    entityType: EntityType;
    companySubType: CompanySubType | null;
    currentStep: string | null;
    steps: StepConfig[];
    isLoading: boolean;

    // Actions
    setApplication: (app: Application) => void;
    setEntityType: (type: EntityType, subType?: CompanySubType) => void;
    setCurrentStep: (step: string) => void;
    setSteps: (steps: StepConfig[]) => void;
    updateCompletedSteps: (step: string, completed: boolean) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
}

const initialState = {
    application: null,
    entityType: 'individual' as EntityType,
    companySubType: null,
    currentStep: null,
    steps: [],
    isLoading: false,
};

export const useApplicationStore = create<ApplicationState>()(
    persist(
        (set) => ({
            ...initialState,

            setApplication: (app) =>
                set({
                    application: app,
                    entityType: app.entityType,
                    companySubType: app.companySubType || null,
                }),

            setEntityType: (type, subType) =>
                set({
                    entityType: type,
                    companySubType: subType || null,
                }),

            setCurrentStep: (step) =>
                set({ currentStep: step }),

            setSteps: (steps) =>
                set({ steps }),

            updateCompletedSteps: (step, completed) =>
                set((state) => ({
                    steps: state.steps.map((s) =>
                        s.id === step ? { ...s, completed } : s
                    ),
                })),

            setLoading: (loading) =>
                set({ isLoading: loading }),

            reset: () => set(initialState),
        }),
        {
            name: 'application-storage',
            partialize: (state) => ({
                entityType: state.entityType,
                companySubType: state.companySubType,
            }),
        }
    )
);

export default useApplicationStore;
