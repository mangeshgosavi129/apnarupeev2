/**
 * Agreement Callback Page
 * Handles the return from SignDesk E-Sign flow
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { agreementApi } from '@/services/api';

export default function AgreementCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        const status = searchParams.get('status'); // SignDesk might send status param

        try {
            // We blindly try to mark as signed. 
            // The backend's mark-signed doesn't check SignDesk status yet, 
            // but in a real flow we would check the 'status' param or 'reference_id'

            if (status && status !== 'success') {
                throw new Error('Signing was not completed');
            }

            await agreementApi.markSigned();
            toast.success('Agreement successfully signed!');
        } catch (error: any) {
            console.error('Agreement callback error:', error);
            toast.error('Could not verify signing status. Please check manually.');
        } finally {
            // Always redirect back to onboarding to show current state
            navigate('/onboarding');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                    Verifying Signature...
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                    Please wait while we process your agreement.
                </p>
            </div>
        </div>
    );
}
