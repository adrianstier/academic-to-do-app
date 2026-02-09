'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Send,
  Clock,
  RefreshCw,
  Trash2,
  Loader2,
  AlertTriangle,
  Check,
  ChevronDown,
  UserPlus,
  X,
  Copy,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/lib/supabaseClient';
import { isInvitationValid, type TeamInvitation, type TeamRole } from '@/types/team';
import { formatDistanceToNow } from 'date-fns';

// ============================================
// Types
// ============================================

interface TeamInviteSectionProps {
  className?: string;
  onInviteSent?: (email: string) => void;
  onInviteRevoked?: (inviteId: string) => void;
}

// ============================================
// Helper Functions
// ============================================

function getRoleLabel(role: Exclude<TeamRole, 'owner'>): string {
  return role === 'admin' ? 'Admin' : 'Member';
}

// ============================================
// Role Selector Component
// ============================================

interface RoleSelectorProps {
  value: Exclude<TeamRole, 'owner'>;
  onChange: (role: Exclude<TeamRole, 'owner'>) => void;
  disabled?: boolean;
}

function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const roles: Array<{ value: Exclude<TeamRole, 'owner'>; label: string; description: string }> = [
    {
      value: 'member',
      label: 'Member',
      description: 'Can view and create tasks',
    },
    {
      value: 'admin',
      label: 'Admin',
      description: 'Can manage members and settings',
    },
  ];

  const selectedRole = roles.find((r) => r.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2.5 rounded-lg
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          text-gray-900 dark:text-white
          hover:border-gray-300 dark:hover:border-gray-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors min-w-[130px]
        `}
      >
        <span className="flex-1 text-left text-sm font-medium">
          {selectedRole?.label}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="
                absolute left-0 top-full mt-1 z-20
                w-56 py-1 rounded-lg shadow-lg
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
              "
            >
              {roles.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => {
                    onChange(role.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full text-left px-3 py-2
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    ${role.value === value ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                    transition-colors
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {role.label}
                    </span>
                    {role.value === value && (
                      <Check className="w-4 h-4 text-[#2c5282] dark:text-[#c9a227]" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {role.description}
                  </p>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Pending Invitation Card
// ============================================

interface InvitationCardProps {
  invitation: TeamInvitation;
  onResend: (invitation: TeamInvitation) => Promise<void>;
  onRevoke: (invitation: TeamInvitation) => Promise<void>;
  isResending: boolean;
  isRevoking: boolean;
}

function InvitationCard({
  invitation,
  onResend,
  onRevoke,
  isResending,
  isRevoking,
}: InvitationCardProps) {
  const isValid = isInvitationValid(invitation);
  const isExpired = !isValid && !invitation.accepted_at;
  const isAccepted = !!invitation.accepted_at;

  const [copiedToken, setCopiedToken] = useState(false);

  const copyInviteLink = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${baseUrl}/invite/${invitation.token}`;
    await navigator.clipboard.writeText(inviteUrl);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`
        flex items-center gap-3 p-3 rounded-lg
        bg-white dark:bg-gray-800
        border ${
          isExpired
            ? 'border-red-200 dark:border-red-800'
            : isAccepted
            ? 'border-green-200 dark:border-green-800'
            : 'border-gray-200 dark:border-gray-700'
        }
        transition-colors
      `}
    >
      {/* Email Icon */}
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center
          ${
            isExpired
              ? 'bg-red-100 dark:bg-red-900/30'
              : isAccepted
              ? 'bg-green-100 dark:bg-green-900/30'
              : 'bg-gray-100 dark:bg-gray-700'
          }
        `}
      >
        <Mail
          className={`
            w-5 h-5
            ${
              isExpired
                ? 'text-red-500 dark:text-red-400'
                : isAccepted
                ? 'text-green-500 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400'
            }
          `}
        />
      </div>

      {/* Invitation Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {invitation.email}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <Badge
            variant={invitation.role === 'admin' ? 'info' : 'default'}
            size="sm"
          >
            {getRoleLabel(invitation.role)}
          </Badge>
          <span className="text-gray-400">|</span>
          {isAccepted ? (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Accepted
            </span>
          ) : isExpired ? (
            <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Expired
            </span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isAccepted && (
        <div className="flex items-center gap-1">
          {/* Copy Link */}
          <button
            onClick={copyInviteLink}
            className="
              p-2 rounded-lg
              text-gray-400 hover:text-[#2c5282] dark:hover:text-[#c9a227]
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
            "
            title="Copy invite link"
          >
            {copiedToken ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          {/* Resend */}
          <button
            onClick={() => onResend(invitation)}
            disabled={isResending}
            className="
              p-2 rounded-lg
              text-gray-400 hover:text-[#2c5282] dark:hover:text-[#c9a227]
              hover:bg-gray-100 dark:hover:bg-gray-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
            title="Resend invitation"
          >
            {isResending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>

          {/* Revoke */}
          <button
            onClick={() => onRevoke(invitation)}
            disabled={isRevoking}
            className="
              p-2 rounded-lg
              text-gray-400 hover:text-red-600
              hover:bg-red-50 dark:hover:bg-red-900/20
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
            title="Revoke invitation"
          >
            {isRevoking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ============================================
// Main Component
// ============================================

export function TeamInviteSection({
  className = '',
  onInviteSent,
  onInviteRevoked,
}: TeamInviteSectionProps) {
  const { currentTeam, currentTeamId, isTeamOwner, isTeamAdmin } = useTeam();

  // Form state
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<TeamRole, 'owner'>>('member');

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data state
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch pending invitations
  const fetchInvitations = useCallback(async () => {
    if (!currentTeamId) {
      setInvitations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Try team_invitations first, fall back to agency_invitations
      let data;
      let fetchError;

      const teamResult = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', currentTeamId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false });

      if (teamResult.error?.code === '42P01') {
        // Table doesn't exist, try agency_invitations
        const agencyResult = await supabase
          .from('agency_invitations')
          .select('*')
          .eq('agency_id', currentTeamId)
          .is('accepted_at', null)
          .order('created_at', { ascending: false });

        data = agencyResult.data;
        fetchError = agencyResult.error;

        if (!fetchError && data) {
          // Transform agency data to team format
          const transformed: TeamInvitation[] = data.map((inv) => ({
            ...inv,
            team_id: inv.agency_id,
          }));
          setInvitations(transformed);
          setIsLoading(false);
          return;
        }
      } else {
        data = teamResult.data;
        fetchError = teamResult.error;
      }

      if (fetchError) {
        throw fetchError;
      }

      setInvitations(data || []);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      setError('Failed to load invitations');
    } finally {
      setIsLoading(false);
    }
  }, [currentTeamId]);

  // Load invitations on mount
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  // Validate email
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Send invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentTeamId) return;

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter an email address');
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if already invited
    const existingInvite = invitations.find(
      (inv) => inv.email.toLowerCase() === trimmedEmail && isInvitationValid(inv)
    );
    if (existingInvite) {
      setError('This email has already been invited');
      return;
    }

    setIsSending(true);
    setError(null);
    setSuccess(null);

    try {
      // Generate invitation token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

      const invitationData = {
        team_id: currentTeamId,
        email: trimmedEmail,
        role,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      };

      // Try team_invitations first, fall back to agency_invitations
      const { data, error: insertError } = await supabase
        .from('team_invitations')
        .insert(invitationData)
        .select()
        .single();

      if (insertError?.code === '42P01') {
        // Table doesn't exist, try agency_invitations
        const agencyInvitationData = {
          ...invitationData,
          agency_id: currentTeamId,
          team_id: undefined,
        };
        delete agencyInvitationData.team_id;

        const { data: agencyData, error: agencyError } = await supabase
          .from('agency_invitations')
          .insert(agencyInvitationData)
          .select()
          .single();

        if (agencyError) throw agencyError;

        // Transform and add to list
        const newInvitation: TeamInvitation = {
          ...agencyData,
          team_id: currentTeamId,
        };
        setInvitations((prev) => [newInvitation, ...prev]);
      } else if (insertError) {
        throw insertError;
      } else if (data) {
        setInvitations((prev) => [data, ...prev]);
      }

      // Reset form
      setEmail('');
      setRole('member');
      setSuccess(`Invitation sent to ${trimmedEmail}`);
      setTimeout(() => setSuccess(null), 3000);
      onInviteSent?.(trimmedEmail);

      // TODO: Actually send the invitation email via API
      // This would typically be handled by a server-side function
    } catch (err) {
      console.error('Failed to send invitation:', err);
      setError('Failed to send invitation. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Resend invitation
  const handleResendInvite = async (invitation: TeamInvitation) => {
    setResendingId(invitation.id);
    setError(null);

    try {
      // Update expiration date
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + 7);

      const updateData = {
        expires_at: newExpiresAt.toISOString(),
      };

      // Try team_invitations first
      const { error: updateError } = await supabase
        .from('team_invitations')
        .update(updateData)
        .eq('id', invitation.id);

      if (updateError?.code === '42P01') {
        const { error: agencyError } = await supabase
          .from('agency_invitations')
          .update(updateData)
          .eq('id', invitation.id);

        if (agencyError) throw agencyError;
      } else if (updateError) {
        throw updateError;
      }

      // Update local state
      setInvitations((prev) =>
        prev.map((inv) =>
          inv.id === invitation.id
            ? { ...inv, expires_at: newExpiresAt.toISOString() }
            : inv
        )
      );

      setSuccess(`Invitation resent to ${invitation.email}`);
      setTimeout(() => setSuccess(null), 3000);

      // TODO: Actually resend the email
      console.log('Would resend email to:', invitation.email);
    } catch (err) {
      console.error('Failed to resend invitation:', err);
      setError('Failed to resend invitation. Please try again.');
    } finally {
      setResendingId(null);
    }
  };

  // Revoke invitation
  const handleRevokeInvite = async (invitation: TeamInvitation) => {
    setRevokingId(invitation.id);
    setError(null);

    try {
      // Delete the invitation
      const { error: deleteError } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitation.id);

      if (deleteError?.code === '42P01') {
        const { error: agencyError } = await supabase
          .from('agency_invitations')
          .delete()
          .eq('id', invitation.id);

        if (agencyError) throw agencyError;
      } else if (deleteError) {
        throw deleteError;
      }

      // Remove from local state
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitation.id));
      onInviteRevoked?.(invitation.id);
    } catch (err) {
      console.error('Failed to revoke invitation:', err);
      setError('Failed to revoke invitation. Please try again.');
    } finally {
      setRevokingId(null);
    }
  };

  // Only admins and owners can invite
  if (!isTeamAdmin && !isTeamOwner) {
    return null;
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-5 h-5 text-[#1e3a5f] dark:text-[#c9a227]" />
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Invite Members
        </h3>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-800 rounded"
            >
              <X className="w-4 h-4 text-red-600 dark:text-red-400" />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          >
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invite Form */}
      <form onSubmit={handleSendInvite} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Email Input */}
          <div className="flex-1">
            <label htmlFor="invite-email" className="sr-only">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@university.edu"
                className="
                  w-full pl-10 pr-4 py-2.5 rounded-lg
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-gray-700
                  text-gray-900 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-[#2c5282] dark:focus:ring-[#c9a227]
                  focus:border-transparent
                  transition-colors
                "
                disabled={isSending}
              />
            </div>
          </div>

          {/* Role Selector */}
          <RoleSelector
            value={role}
            onChange={setRole}
            disabled={isSending}
          />

          {/* Send Button */}
          <Button
            type="submit"
            variant="primary"
            loading={isSending}
            disabled={!email.trim()}
            leftIcon={<Send className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Send Invite</span>
            <span className="sm:hidden">Send</span>
          </Button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Invitations expire after 7 days. The recipient will receive an email with a link to join.
        </p>
      </form>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Pending Invitations
            </h4>
            <Badge variant="default" size="sm">
              {invitations.filter((inv) => isInvitationValid(inv)).length} active
            </Badge>
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {isLoading ? (
                <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Loading invitations...
                </div>
              ) : (
                invitations.map((invitation) => (
                  <InvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    onResend={handleResendInvite}
                    onRevoke={handleRevokeInvite}
                    isResending={resendingId === invitation.id}
                    isRevoking={revokingId === invitation.id}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && invitations.length === 0 && (
        <div className="mt-6 py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Mail className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No pending invitations
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Invite team members using the form above
          </p>
        </div>
      )}
    </div>
  );
}

export default TeamInviteSection;
