'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Check, Plus, Shield, Crown, User } from 'lucide-react';
import { useTeam } from '@/contexts/TeamContext';
import type { TeamRole } from '@/types/team';

// ============================================
// Types
// ============================================

interface TeamSwitcherProps {
  /** Callback when "Create Team" is clicked */
  onCreateTeam?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show role badge */
  showRole?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================
// Helper Functions
// ============================================

const getRoleIcon = (role: TeamRole) => {
  switch (role) {
    case 'owner':
      return <Crown className="w-3 h-3" />;
    case 'admin':
      return <Shield className="w-3 h-3" />;
    default:
      return <User className="w-3 h-3" />;
  }
};

const getRoleLabel = (role: TeamRole) => {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    default:
      return 'Member';
  }
};

const getRoleColor = (role: TeamRole) => {
  switch (role) {
    case 'owner':
      return 'text-yellow-500';
    case 'admin':
      return 'text-blue-500';
    default:
      return 'text-gray-500 dark:text-gray-400';
  }
};

// ============================================
// Component
// ============================================

export function TeamSwitcher({
  onCreateTeam,
  size = 'md',
  showRole = true,
  className = '',
}: TeamSwitcherProps) {
  const {
    currentTeam,
    currentRole,
    teams,
    isLoading,
    isMultiTenancyEnabled,
    switchTeam,
  } = useTeam();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Don't render if multi-tenancy is disabled
  if (!isMultiTenancyEnabled) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base',
  };

  const handleSelectTeam = async (teamId: string) => {
    await switchTeam(teamId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={`
          flex items-center gap-2 rounded-lg
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          hover:bg-gray-50 dark:hover:bg-gray-700
          transition-colors
          ${sizeClasses[size]}
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Team Icon */}
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: currentTeam?.primary_color || '#4F46E5' }}
        >
          {currentTeam?.name?.charAt(0) || <Users className="w-4 h-4" />}
        </div>

        {/* Team Name */}
        <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px]">
          {isLoading ? 'Loading...' : (currentTeam?.name || 'Select Team')}
        </span>

        {/* Role Badge */}
        {showRole && currentRole && (
          <span className={`flex items-center gap-1 ${getRoleColor(currentRole)}`}>
            {getRoleIcon(currentRole)}
          </span>
        )}

        {/* Dropdown Arrow */}
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="
              absolute z-50 mt-1 w-72
              bg-white dark:bg-gray-800
              border border-gray-200 dark:border-gray-700
              rounded-lg shadow-lg
              overflow-hidden
            "
            role="listbox"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Your Teams
              </p>
            </div>

            {/* Team List */}
            <div className="max-h-64 overflow-y-auto py-1">
              {teams.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No teams yet</p>
                </div>
              ) : (
                teams.map((team) => (
                  <button
                    key={team.team_id}
                    onClick={() => handleSelectTeam(team.team_id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2
                      hover:bg-gray-50 dark:hover:bg-gray-700
                      transition-colors text-left
                      ${team.team_id === currentTeam?.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                    `}
                    role="option"
                    aria-selected={team.team_id === currentTeam?.id}
                  >
                    {/* Team Icon */}
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: '#1e3a5f' }} // Academic navy
                    >
                      {team.team_name.charAt(0)}
                    </div>

                    {/* Team Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {team.team_name}
                      </p>
                      <p className={`text-xs flex items-center gap-1 ${getRoleColor(team.role)}`}>
                        {getRoleIcon(team.role)}
                        {getRoleLabel(team.role)}
                        {team.is_default && (
                          <span className="text-gray-400 dark:text-gray-500 ml-1">
                            (Default)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Selected Checkmark */}
                    {team.team_id === currentTeam?.id && (
                      <Check className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Create Team Button */}
            {onCreateTeam && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700" />
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onCreateTeam();
                  }}
                  className="
                    w-full flex items-center gap-2 px-3 py-2
                    text-blue-600 dark:text-blue-400
                    hover:bg-blue-50 dark:hover:bg-blue-900/20
                    transition-colors
                  "
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Create New Team</span>
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Mini Variant for Compact Spaces
// ============================================

interface TeamSwitcherMiniProps {
  className?: string;
}

export function TeamSwitcherMini({ className = '' }: TeamSwitcherMiniProps) {
  const { currentTeam, isMultiTenancyEnabled } = useTeam();

  if (!isMultiTenancyEnabled || !currentTeam) {
    return null;
  }

  return (
    <div
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded
        bg-gray-100 dark:bg-gray-700/50
        text-xs text-gray-600 dark:text-gray-300
        ${className}
      `}
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center text-white text-[10px] font-bold"
        style={{ backgroundColor: currentTeam.primary_color || '#4F46E5' }}
      >
        {currentTeam.name.charAt(0)}
      </div>
      <span className="truncate max-w-[100px]">{currentTeam.name}</span>
    </div>
  );
}

// ============================================
// Backward Compatibility Aliases
// ============================================

/** @deprecated Use TeamSwitcher instead */
export const AgencySwitcher = TeamSwitcher;
/** @deprecated Use TeamSwitcherMini instead */
export const AgencySwitcherMini = TeamSwitcherMini;

export default TeamSwitcher;
