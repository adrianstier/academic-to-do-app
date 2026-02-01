'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  UserPlus,
  Building2,
  Link as LinkIcon,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { generateTeamSlug } from '@/types/team';

// ============================================
// Types
// ============================================

interface TeamOnboardingModalProps {
  userId: string;
  userName: string;
  onComplete: () => void;
}

type Step = 'choice' | 'create' | 'join' | 'complete';

// ============================================
// Constants
// ============================================

const ACADEMIC_COLORS = {
  primary: '#1e3a5f',
  secondary: '#2c5282',
  accent: '#6b9ac4',
  gold: '#c9a227',
};

// ============================================
// Animation Variants
// ============================================

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 20 },
};

const contentVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// ============================================
// Component
// ============================================

export default function TeamOnboardingModal({
  userId,
  userName,
  onComplete,
}: TeamOnboardingModalProps) {
  const [step, setStep] = useState<Step>('choice');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create team form
  const [teamName, setTeamName] = useState('');
  const [teamSlug, setTeamSlug] = useState('');

  // Join team form
  const [inviteCode, setInviteCode] = useState('');

  // Update slug when team name changes
  useEffect(() => {
    if (teamName) {
      setTeamSlug(generateTeamSlug(teamName));
    }
  }, [teamName]);

  // ============================================
  // Handlers
  // ============================================

  const handleCreateTeam = async () => {
    // Validation
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    if (teamName.trim().length < 3) {
      setError('Team name must be at least 3 characters');
      return;
    }
    if (!teamSlug.trim()) {
      setError('Please enter a team URL');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(teamSlug)) {
      setError('Team URL can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Slug uniqueness enforced by DB UNIQUE constraint — no client-side race condition
      // Try to create team with the new RPC, fall back to agency RPC
      let teamId;
      let rpcError;

      const teamResult = await supabase.rpc('create_team_with_owner', {
        p_name: teamName.trim(),
        p_slug: teamSlug.trim(),
        p_user_id: userId,
      });

      if (teamResult.error?.code === '42883') {
        // Function doesn't exist, try agency RPC
        const agencyResult = await supabase.rpc('create_agency_with_owner', {
          p_name: teamName.trim(),
          p_slug: teamSlug.trim(),
          p_user_id: userId,
        });

        teamId = agencyResult.data;
        rpcError = agencyResult.error;
      } else {
        teamId = teamResult.data;
        rpcError = teamResult.error;
      }

      if (rpcError) throw rpcError;

      console.log('Created team:', teamId);
      setStep('complete');
    } catch (err: unknown) {
      console.error('Error creating team:', err);
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === '23505') {
        setError('This team URL is already taken. Please choose another.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create team');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invite code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to accept team invitation first, then agency invitation
      let acceptError;

      const teamResult = await supabase.rpc('accept_team_invitation', {
        p_token: inviteCode.trim(),
        p_user_id: userId,
      });

      if (teamResult.error?.code === '42883') {
        // Function doesn't exist, try agency RPC
        const agencyResult = await supabase.rpc('accept_agency_invitation', {
          p_token: inviteCode.trim(),
          p_user_id: userId,
        });
        acceptError = agencyResult.error;
      } else {
        acceptError = teamResult.error;
      }

      if (acceptError) {
        if (acceptError.message?.includes('expired')) {
          setError('This invite code has expired');
        } else if (acceptError.message?.includes('already')) {
          setError('This invite code has already been used');
        } else if (acceptError.message?.includes('not found') || acceptError.message?.includes('Invalid')) {
          setError('Invalid invite code. Please check and try again.');
        } else {
          throw acceptError;
        }
        setIsLoading(false);
        return;
      }

      setStep('complete');
    } catch (err) {
      console.error('Error joining team:', err);
      setError(err instanceof Error ? err.message : 'Failed to join team');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Auto-create a personal workspace team
      const personalSlug = generateTeamSlug(`${userName}-workspace`);

      let rpcError;
      const teamResult = await supabase.rpc('create_team_with_owner', {
        p_name: `${userName}'s Workspace`,
        p_slug: personalSlug,
        p_user_id: userId,
      });

      if (teamResult.error?.code === '42883') {
        const agencyResult = await supabase.rpc('create_agency_with_owner', {
          p_name: `${userName}'s Workspace`,
          p_slug: personalSlug,
          p_user_id: userId,
        });
        rpcError = agencyResult.error;
      } else {
        rpcError = teamResult.error;
      }

      if (rpcError) throw rpcError;
      setStep('complete');
    } catch (err: unknown) {
      console.error('Error creating personal workspace:', err);
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === '23505') {
        // Slug collision — try with a random suffix
        try {
          const suffix = Math.random().toString(36).slice(2, 6);
          const fallbackSlug = generateTeamSlug(`${userName}-workspace-${suffix}`);
          const result = await supabase.rpc('create_team_with_owner', {
            p_name: `${userName}'s Workspace`,
            p_slug: fallbackSlug,
            p_user_id: userId,
          });
          if (result.error) throw result.error;
          setStep('complete');
          return;
        } catch {
          setError('Failed to create personal workspace. Please try creating a team instead.');
        }
      } else {
        setError('Failed to create personal workspace. Please try creating a team instead.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    onComplete();
  };

  // ============================================
  // Render
  // ============================================

  return (
    <AnimatePresence>
      <motion.div
        variants={backdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header with gradient */}
          <div
            className="px-6 py-5 text-white relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${ACADEMIC_COLORS.primary} 0%, ${ACADEMIC_COLORS.secondary} 100%)`,
            }}
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Welcome, {userName}!</h2>
                  <p className="text-sm text-white/80">Let&apos;s get you set up</p>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {/* Choice Step */}
              {step === 'choice' && (
                <motion.div
                  key="choice"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                >
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    To get started, you need to be part of a team. Would you like to create a new team or join an existing one?
                  </p>

                  <div className="space-y-3">
                    {/* Skip for now */}
                    <button
                      onClick={handleSkip}
                      disabled={isLoading}
                      className="
                        w-full p-3 rounded-lg text-sm
                        text-gray-500 dark:text-gray-400
                        hover:bg-gray-100 dark:hover:bg-gray-700
                        transition-colors text-center
                        disabled:opacity-50 disabled:cursor-not-allowed
                      "
                    >
                      {isLoading ? 'Creating personal workspace...' : 'Skip for now (create personal workspace)'}
                    </button>

                    {/* Create Team Option */}
                    <button
                      onClick={() => {
                        setError(null);
                        setStep('create');
                      }}
                      className="
                        w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600
                        hover:border-[#2c5282] dark:hover:border-[#6b9ac4]
                        hover:bg-[#2c5282]/5 dark:hover:bg-[#6b9ac4]/10
                        transition-all group text-left
                      "
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                          style={{ backgroundColor: `${ACADEMIC_COLORS.secondary}15` }}
                        >
                          <Plus
                            className="w-6 h-6 transition-colors"
                            style={{ color: ACADEMIC_COLORS.secondary }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Create a New Team
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Start fresh with your own research team
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#2c5282] dark:group-hover:text-[#6b9ac4] transition-colors" />
                      </div>
                    </button>

                    {/* Join Team Option */}
                    <button
                      onClick={() => {
                        setError(null);
                        setStep('join');
                      }}
                      className="
                        w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-600
                        hover:border-[#c9a227] dark:hover:border-[#d4b84a]
                        hover:bg-[#c9a227]/5 dark:hover:bg-[#c9a227]/10
                        transition-all group text-left
                      "
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center transition-colors"
                          style={{ backgroundColor: `${ACADEMIC_COLORS.gold}15` }}
                        >
                          <UserPlus
                            className="w-6 h-6 transition-colors"
                            style={{ color: ACADEMIC_COLORS.gold }}
                          />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            Join an Existing Team
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Enter an invite code to join a team
                          </p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#c9a227] dark:group-hover:text-[#d4b84a] transition-colors" />
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Create Team Step */}
              {step === 'create' && (
                <motion.div
                  key="create"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <Building2 className="w-5 h-5 text-[#2c5282]" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Create Your Team
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Team Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Team Name
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={teamName}
                          onChange={(e) => {
                            setTeamName(e.target.value);
                            setError(null);
                          }}
                          placeholder="e.g., Smith Research Lab"
                          className="
                            w-full pl-10 pr-4 py-2.5 rounded-lg
                            border border-gray-300 dark:border-gray-600
                            bg-white dark:bg-gray-700
                            text-gray-900 dark:text-white
                            placeholder-gray-400
                            focus:ring-2 focus:ring-[#2c5282] focus:border-[#2c5282]
                            transition-colors
                          "
                        />
                      </div>
                    </div>

                    {/* Team URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Team URL
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 whitespace-nowrap">
                          app.example.com/
                        </span>
                        <div className="relative flex-1">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={teamSlug}
                            onChange={(e) => {
                              setTeamSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                              setError(null);
                            }}
                            placeholder="smith-lab"
                            className="
                              w-full pl-9 pr-4 py-2.5 rounded-lg
                              border border-gray-300 dark:border-gray-600
                              bg-white dark:bg-gray-700
                              text-gray-900 dark:text-white
                              placeholder-gray-400
                              focus:ring-2 focus:ring-[#2c5282] focus:border-[#2c5282]
                              font-mono text-sm transition-colors
                            "
                          />
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400">
                        This will be your unique team identifier
                      </p>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        setError(null);
                        setStep('choice');
                      }}
                      className="
                        flex-1 py-2.5 px-4 rounded-lg
                        border border-gray-300 dark:border-gray-600
                        text-gray-700 dark:text-gray-300
                        hover:bg-gray-50 dark:hover:bg-gray-700
                        transition-colors flex items-center justify-center gap-2
                      "
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={handleCreateTeam}
                      disabled={isLoading}
                      className={`
                        flex-1 py-2.5 px-4 rounded-lg
                        text-white font-medium
                        transition-colors flex items-center justify-center gap-2
                        ${isLoading
                          ? 'bg-[#2c5282]/50 cursor-not-allowed'
                          : 'bg-[#2c5282] hover:bg-[#1e3a5f]'
                        }
                      `}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Team
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Join Team Step */}
              {step === 'join' && (
                <motion.div
                  key="join"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2 mb-6">
                    <UserPlus className="w-5 h-5 text-[#c9a227]" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Join a Team
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Info Box */}
                    <div className="p-4 rounded-lg bg-[#c9a227]/10 dark:bg-[#c9a227]/20 border border-[#c9a227]/30">
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Ask your team administrator for an invite code. They can generate one from the team settings.
                      </p>
                    </div>

                    {/* Invite Code Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={(e) => {
                          setInviteCode(e.target.value);
                          setError(null);
                        }}
                        placeholder="Enter your invite code"
                        className="
                          w-full px-4 py-2.5 rounded-lg
                          border border-gray-300 dark:border-gray-600
                          bg-white dark:bg-gray-700
                          text-gray-900 dark:text-white
                          placeholder-gray-400
                          focus:ring-2 focus:ring-[#c9a227] focus:border-[#c9a227]
                          font-mono tracking-wider text-center
                          transition-colors
                        "
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        setError(null);
                        setStep('choice');
                      }}
                      className="
                        flex-1 py-2.5 px-4 rounded-lg
                        border border-gray-300 dark:border-gray-600
                        text-gray-700 dark:text-gray-300
                        hover:bg-gray-50 dark:hover:bg-gray-700
                        transition-colors flex items-center justify-center gap-2
                      "
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={handleJoinTeam}
                      disabled={isLoading}
                      className={`
                        flex-1 py-2.5 px-4 rounded-lg
                        text-white font-medium
                        transition-colors flex items-center justify-center gap-2
                        ${isLoading
                          ? 'bg-[#c9a227]/50 cursor-not-allowed'
                          : 'bg-[#c9a227] hover:bg-[#b08f1f]'
                        }
                      `}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          Join Team
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Complete Step */}
              {step === 'complete' && (
                <motion.div
                  key="complete"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={{ duration: 0.2 }}
                  className="text-center py-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                    className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${ACADEMIC_COLORS.accent}20` }}
                  >
                    <Check className="w-10 h-10" style={{ color: ACADEMIC_COLORS.secondary }} />
                  </motion.div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    You&apos;re All Set!
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Your team is ready. Let&apos;s start managing your research projects.
                  </p>

                  <button
                    onClick={handleComplete}
                    className="
                      w-full py-3 px-4 rounded-lg
                      text-white font-medium
                      transition-colors
                      bg-[#2c5282] hover:bg-[#1e3a5f]
                    "
                  >
                    Get Started
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
