'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Crown,
  Shield,
  User,
  ChevronDown,
  Trash2,
  Loader2,
  AlertTriangle,
  Check,
  MoreVertical,
  ArrowRightLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/lib/supabaseClient';
import { getAcademicRoleLabel, getAcademicRoleShort } from '@/lib/academicRoles';
import type { TeamMember, TeamRole } from '@/types/team';

// ============================================
// Types
// ============================================

interface TeamMembersListProps {
  className?: string;
  onMemberRemoved?: (memberId: string) => void;
  onRoleChanged?: (memberId: string, newRole: TeamRole) => void;
}

interface MemberWithUser extends TeamMember {
  user?: {
    id: string;
    name: string;
    color: string;
    email?: string;
  };
}

// ============================================
// Helper Components
// ============================================

function getRoleIcon(role: TeamRole) {
  switch (role) {
    case 'owner':
      return <Crown className="w-3.5 h-3.5" />;
    case 'admin':
      return <Shield className="w-3.5 h-3.5" />;
    default:
      return <User className="w-3.5 h-3.5" />;
  }
}

function getRoleBadgeVariant(role: TeamRole): 'warning' | 'info' | 'default' {
  switch (role) {
    case 'owner':
      return 'warning';
    case 'admin':
      return 'info';
    default:
      return 'default';
  }
}

function getRoleLabel(role: TeamRole): string {
  return getAcademicRoleLabel(role);
}

function getRoleShortLabel(role: TeamRole): string {
  return getAcademicRoleShort(role);
}

// ============================================
// Avatar Component
// ============================================

interface MemberAvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

function MemberAvatar({ name, color, size = 'md' }: MemberAvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        rounded-full flex items-center justify-center
        font-semibold text-white
        ring-2 ring-white dark:ring-gray-800
      `}
      style={{ backgroundColor: color || '#1e3a5f' }}
    >
      {initials}
    </div>
  );
}

// ============================================
// Role Dropdown Component
// ============================================

interface RoleDropdownProps {
  currentRole: TeamRole;
  memberId: string;
  memberName: string;
  isOwner: boolean;
  onRoleChange: (memberId: string, newRole: TeamRole) => Promise<void>;
  disabled?: boolean;
}

function RoleDropdown({
  currentRole,
  memberId,
  memberName,
  isOwner,
  onRoleChange,
  disabled,
}: RoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  // Can't change owner's role
  if (currentRole === 'owner') {
    return (
      <Badge variant={getRoleBadgeVariant(currentRole)} size="md">
        {getRoleIcon(currentRole)}
        {getRoleLabel(currentRole)}
      </Badge>
    );
  }

  const availableRoles: TeamRole[] = isOwner
    ? ['admin', 'member']
    : ['member'];

  const handleRoleChange = async (newRole: TeamRole) => {
    if (newRole === currentRole) {
      setIsOpen(false);
      return;
    }

    setIsChanging(true);
    try {
      await onRoleChange(memberId, newRole);
    } finally {
      setIsChanging(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isChanging}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
          text-sm font-medium
          bg-gray-100 dark:bg-gray-700
          text-gray-700 dark:text-gray-300
          hover:bg-gray-200 dark:hover:bg-gray-600
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors
        `}
      >
        {isChanging ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          getRoleIcon(currentRole)
        )}
        {getRoleLabel(currentRole)}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="
                absolute right-0 top-full mt-1 z-20
                w-40 py-1 rounded-lg shadow-lg
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
              "
            >
              {availableRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-2
                    text-sm text-left
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    ${role === currentRole ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                    transition-colors
                  `}
                >
                  {getRoleIcon(role)}
                  <span className="flex-1">{getRoleLabel(role)}</span>
                  {role === currentRole && (
                    <Check className="w-4 h-4 text-[#2c5282] dark:text-[#c9a227]" />
                  )}
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
// Main Component
// ============================================

export function TeamMembersList({
  className = '',
  onMemberRemoved,
  onRoleChanged,
}: TeamMembersListProps) {
  const { currentTeam, currentTeamId, isTeamOwner, isTeamAdmin, hasPermission } = useTeam();
  const canManageRoles = hasPermission('can_manage_roles');

  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<MemberWithUser | null>(null);
  const [confirmTransferMember, setConfirmTransferMember] = useState<MemberWithUser | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Fetch team members
  const fetchMembers = useCallback(async () => {
    if (!currentTeamId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Try team_members table first, fall back to agency_members
      let data;
      let fetchError;

      const teamResult = await supabase
        .from('team_members')
        .select(`
          id,
          team_id,
          user_id,
          role,
          permissions,
          status,
          is_default_team,
          joined_at,
          created_at,
          updated_at,
          users!inner (
            id,
            name,
            color,
            email
          )
        `)
        .eq('team_id', currentTeamId)
        .eq('status', 'active')
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (teamResult.error?.code === '42P01') {
        // Table doesn't exist, try agency_members
        const agencyResult = await supabase
          .from('agency_members')
          .select(`
            id,
            agency_id,
            user_id,
            role,
            permissions,
            status,
            is_default_agency,
            joined_at,
            created_at,
            updated_at,
            users!inner (
              id,
              name,
              color,
              email
            )
          `)
          .eq('agency_id', currentTeamId)
          .eq('status', 'active')
          .order('role', { ascending: true })
          .order('joined_at', { ascending: true });

        data = agencyResult.data;
        fetchError = agencyResult.error;

        if (!fetchError && data) {
          // Transform agency data to team format
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const rawData = data as any[];
          const transformed: MemberWithUser[] = rawData.map((m) => ({
            id: m.id,
            team_id: m.agency_id,
            user_id: m.user_id,
            role: m.role,
            permissions: m.permissions,
            status: m.status,
            is_default_team: m.is_default_agency,
            joined_at: m.joined_at,
            created_at: m.created_at,
            updated_at: m.updated_at,
            user: m.users,
          }));
          setMembers(transformed);
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

      // Transform data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawData = data as any[];
      const transformed: MemberWithUser[] = rawData.map((m) => ({
        id: m.id,
        team_id: m.team_id,
        user_id: m.user_id,
        role: m.role,
        permissions: m.permissions,
        status: m.status,
        is_default_team: m.is_default_team,
        joined_at: m.joined_at,
        created_at: m.created_at,
        updated_at: m.updated_at,
        user: m.users,
      }));

      // Sort: owner first, then admin, then members
      transformed.sort((a, b) => {
        const roleOrder = { owner: 0, admin: 1, member: 2 };
        return roleOrder[a.role] - roleOrder[b.role];
      });

      setMembers(transformed);
    } catch (err) {
      console.error('Failed to fetch team members:', err);
      setError('Failed to load lab members');
    } finally {
      setIsLoading(false);
    }
  }, [currentTeamId]);

  // Load members on mount and when team changes
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!currentTeamId) return;

    const channel = supabase
      .channel('team-members-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${currentTeamId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTeamId, fetchMembers]);

  // Change member role
  const handleRoleChange = async (memberId: string, newRole: TeamRole) => {
    try {
      const updateData = {
        role: newRole,
        updated_at: new Date().toISOString(),
      };

      // Try team_members first, fall back to agency_members
      const { error: teamError } = await supabase
        .from('team_members')
        .update(updateData)
        .eq('id', memberId);

      if (teamError?.code === '42P01') {
        const { error: agencyError } = await supabase
          .from('agency_members')
          .update(updateData)
          .eq('id', memberId);

        if (agencyError) throw agencyError;
      } else if (teamError) {
        throw teamError;
      }

      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, role: newRole } : m
        )
      );

      onRoleChanged?.(memberId, newRole);
    } catch (err) {
      console.error('Failed to change member role:', err);
      setError('Failed to update role. Please try again.');
    }
  };

  // Remove member from team
  const handleRemoveMember = async (member: MemberWithUser) => {
    if (!member || member.role === 'owner') return;

    setRemovingMemberId(member.id);

    try {
      // Soft delete by setting status to 'suspended'
      const updateData = {
        status: 'suspended',
        updated_at: new Date().toISOString(),
      };

      // Try team_members first, fall back to agency_members
      const { error: teamError } = await supabase
        .from('team_members')
        .update(updateData)
        .eq('id', member.id);

      if (teamError?.code === '42P01') {
        const { error: agencyError } = await supabase
          .from('agency_members')
          .update(updateData)
          .eq('id', member.id);

        if (agencyError) throw agencyError;
      } else if (teamError) {
        throw teamError;
      }

      // Remove from local state
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setConfirmRemoveMember(null);
      onMemberRemoved?.(member.id);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError('Failed to remove member. Please try again.');
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Transfer ownership
  const handleTransferOwnership = async (member: MemberWithUser) => {
    if (!member || !currentTeamId || !isTeamOwner) return;

    setIsTransferring(true);
    setError(null);

    try {
      // Get current user ID from the owner member entry
      const ownerMember = members.find((m) => m.role === 'owner');
      if (!ownerMember) throw new Error('Owner not found');

      const { error: rpcError } = await supabase.rpc('transfer_team_ownership', {
        p_team_id: currentTeamId,
        p_current_owner_id: ownerMember.user_id,
        p_new_owner_id: member.user_id,
      });

      if (rpcError) throw rpcError;

      // Refresh the members list
      await fetchMembers();
      setConfirmTransferMember(null);
    } catch (err) {
      console.error('Failed to transfer ownership:', err);
      setError('Failed to transfer ownership. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading lab members...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && members.length === 0) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchMembers}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#1e3a5f] dark:text-[#c9a227]" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Lab Members
          </h3>
          <Badge variant="default" size="sm">
            {members.length}
          </Badge>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
        >
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </motion.div>
      )}

      {/* Members List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {members.map((member) => (
            <motion.div
              key={member.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="
                flex items-center gap-3 p-3 rounded-lg
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                hover:border-gray-300 dark:hover:border-gray-600
                transition-colors
              "
            >
              {/* Avatar */}
              <MemberAvatar
                name={member.user?.name || 'Unknown'}
                color={member.user?.color || '#1e3a5f'}
              />

              {/* Member Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {member.user?.name || 'Unknown User'}
                </p>
                {member.user?.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {member.user.email}
                  </p>
                )}
              </div>

              {/* Role Badge / Dropdown */}
              {canManageRoles && member.role !== 'owner' ? (
                <RoleDropdown
                  currentRole={member.role}
                  memberId={member.id}
                  memberName={member.user?.name || 'Unknown'}
                  isOwner={isTeamOwner}
                  onRoleChange={handleRoleChange}
                  disabled={removingMemberId === member.id}
                />
              ) : (
                <Badge variant={getRoleBadgeVariant(member.role)} size="md">
                  {getRoleIcon(member.role)}
                  {getRoleLabel(member.role)}
                </Badge>
              )}

              {/* Transfer Ownership Button (owner only, for non-owner members) */}
              {isTeamOwner && member.role !== 'owner' && (
                <button
                  onClick={() => setConfirmTransferMember(member)}
                  disabled={removingMemberId === member.id || isTransferring}
                  className="
                    p-2 rounded-lg
                    text-gray-400 hover:text-[#c9a227]
                    hover:bg-[#c9a227]/10
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                  "
                  aria-label={`Transfer PI role to ${member.user?.name}`}
                  title="Transfer PI role"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              )}

              {/* Suspend Button (admin/owner only, can't remove owner) */}
              {canManageRoles && member.role !== 'owner' && (
                <button
                  onClick={() => setConfirmRemoveMember(member)}
                  disabled={removingMemberId === member.id}
                  className="
                    p-2 rounded-lg
                    text-gray-400 hover:text-red-600
                    hover:bg-red-50 dark:hover:bg-red-900/20
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors
                  "
                  aria-label={`Suspend ${member.user?.name}`}
                  title="Suspend member"
                >
                  {removingMemberId === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {members.length === 0 && (
        <div className="py-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            No lab members yet
          </p>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      <AnimatePresence>
        {confirmRemoveMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setConfirmRemoveMember(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="
                w-full max-w-sm p-6 rounded-xl
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                shadow-xl
              "
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Suspend Member?
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to suspend{' '}
                <strong>{confirmRemoveMember.user?.name}</strong> from{' '}
                <strong>{currentTeam?.name}</strong>? They will lose access to lab
                resources until reactivated.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setConfirmRemoveMember(null)}
                  disabled={removingMemberId !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  onClick={() => handleRemoveMember(confirmRemoveMember)}
                  loading={removingMemberId === confirmRemoveMember.id}
                >
                  Suspend
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Ownership Confirmation Dialog */}
      <AnimatePresence>
        {confirmTransferMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setConfirmTransferMember(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="
                w-full max-w-sm p-6 rounded-xl
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                shadow-xl
              "
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#c9a227]/20 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5 text-[#c9a227]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Transfer PI Role?
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Transfer the Principal Investigator role for{' '}
                <strong>{currentTeam?.name}</strong> to{' '}
                <strong>{confirmTransferMember.user?.name}</strong>?
                You will become a Lab Manager. This action cannot be undone.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => setConfirmTransferMember(null)}
                  disabled={isTransferring}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => handleTransferOwnership(confirmTransferMember)}
                  loading={isTransferring}
                >
                  Transfer
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default TeamMembersList;
