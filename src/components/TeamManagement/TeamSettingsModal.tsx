'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Link,
  Palette,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/lib/supabaseClient';
import { generateTeamSlug } from '@/types/team';

// ============================================
// Types
// ============================================

interface TeamSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamDeleted?: () => void;
}

// Academic color palette
const ACADEMIC_COLORS = [
  { name: 'Navy', value: '#1e3a5f' },
  { name: 'Blue', value: '#2c5282' },
  { name: 'Gold', value: '#c9a227' },
  { name: 'Teal', value: '#2c7a7b' },
  { name: 'Purple', value: '#553c9a' },
  { name: 'Green', value: '#276749' },
  { name: 'Rose', value: '#9f1239' },
  { name: 'Orange', value: '#c05621' },
];

// ============================================
// Component
// ============================================

export function TeamSettingsModal({
  isOpen,
  onClose,
  onTeamDeleted,
}: TeamSettingsModalProps) {
  const { currentTeam, isTeamOwner, hasPermission, refreshTeams } = useTeam();
  const canManageSettings = isTeamOwner || hasPermission('can_manage_team_settings');
  const canDeleteTeam = isTeamOwner || hasPermission('can_delete_team');

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1e3a5f');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initialize form with current team data
  useEffect(() => {
    if (currentTeam && isOpen) {
      setName(currentTeam.name);
      setSlug(currentTeam.slug);
      setPrimaryColor(currentTeam.primary_color || '#1e3a5f');
      setSlugManuallyEdited(false);
      setError(null);
      setSuccess(null);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    }
  }, [currentTeam, isOpen]);

  // Auto-generate slug from name
  const handleNameChange = useCallback((newName: string) => {
    setName(newName);
    if (!slugManuallyEdited) {
      setSlug(generateTeamSlug(newName));
    }
  }, [slugManuallyEdited]);

  // Handle slug manual edit
  const handleSlugChange = useCallback((newSlug: string) => {
    setSlugManuallyEdited(true);
    // Sanitize slug: lowercase, alphanumeric and hyphens only
    const sanitized = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
  }, []);

  // Validate form
  const validateForm = useCallback((): string | null => {
    if (!name.trim()) {
      return 'Lab name is required';
    }
    if (name.trim().length < 2) {
      return 'Lab name must be at least 2 characters';
    }
    if (!slug.trim()) {
      return 'Lab URL is required';
    }
    if (slug.length < 2) {
      return 'Lab URL must be at least 2 characters';
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return 'Lab URL can only contain lowercase letters, numbers, and hyphens';
    }
    return null;
  }, [name, slug]);

  // Save changes
  const handleSave = async () => {
    if (!currentTeam) return;
    if (!canManageSettings) {
      setError('You do not have permission to modify lab settings');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Update team — slug uniqueness enforced by DB UNIQUE constraint
      const updateData = {
        name: name.trim(),
        slug: slug.trim(),
        primary_color: primaryColor,
        updated_at: new Date().toISOString(),
      };

      // Try teams table first, fall back to agencies
      const { error: teamError } = await supabase
        .from('teams')
        .update(updateData)
        .eq('id', currentTeam.id);

      if (teamError?.code === '42P01') {
        // Table doesn't exist, try agencies
        const { error: agencyError } = await supabase
          .from('agencies')
          .update(updateData)
          .eq('id', currentTeam.id);

        if (agencyError) throw agencyError;
      } else if (teamError) {
        throw teamError;
      }

      // Refresh teams in context
      await refreshTeams();

      setSuccess('Lab settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to save team settings:', err);
      // Handle unique constraint violation on slug
      const errorCode = (err as { code?: string })?.code;
      if (errorCode === '23505') {
        setError('This lab URL is already taken. Please choose a different one.');
      } else {
        setError('Failed to save settings. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete team
  const handleDelete = async () => {
    if (!currentTeam || !isTeamOwner) return;

    // Require typing team name to confirm
    if (deleteConfirmText !== currentTeam.name) {
      setError('Please type the lab name exactly to confirm deactivation');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Try teams table first, fall back to agencies
      const { error: teamError } = await supabase
        .from('teams')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', currentTeam.id);

      if (teamError?.code === '42P01') {
        // Table doesn't exist, try agencies
        const { error: agencyError } = await supabase
          .from('agencies')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', currentTeam.id);

        if (agencyError) throw agencyError;
      } else if (teamError) {
        throw teamError;
      }

      // Refresh teams and notify parent
      await refreshTeams();
      onClose();
      onTeamDeleted?.();
    } catch (err) {
      console.error('Failed to delete team:', err);
      setError('Failed to deactivate lab. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if form has changes
  const hasChanges = currentTeam && (
    name !== currentTeam.name ||
    slug !== currentTeam.slug ||
    primaryColor !== (currentTeam.primary_color || '#1e3a5f')
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lab Settings"
      size="lg"
    >
      <ModalHeader>
        <div className="flex items-center gap-3 pr-8">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: primaryColor }}
          >
            <Settings className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lab Settings
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your lab&apos;s profile and preferences
            </p>
          </div>
        </div>
      </ModalHeader>

      <ModalBody className="space-y-6">
        {/* Error/Success Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
          >
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
          >
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">{success}</p>
          </motion.div>
        )}

        {/* Team Name */}
        <div className="space-y-2">
          <label
            htmlFor="team-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Lab Name
          </label>
          <input
            id="team-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Enter lab name"
            className="
              w-full px-4 py-2.5 rounded-lg
              bg-white dark:bg-gray-800
              border border-gray-200 dark:border-gray-700
              text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-500
              focus:outline-none focus:ring-2 focus:ring-[#2c5282] dark:focus:ring-[#c9a227]
              focus:border-transparent
              transition-colors
            "
          />
        </div>

        {/* Team URL/Slug */}
        <div className="space-y-2">
          <label
            htmlFor="team-slug"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            <span className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              Lab URL
            </span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              /team/
            </span>
            <input
              id="team-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="team-url"
              className="
                flex-1 px-4 py-2.5 rounded-lg
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                focus:outline-none focus:ring-2 focus:ring-[#2c5282] dark:focus:ring-[#c9a227]
                focus:border-transparent
                transition-colors
                font-mono text-sm
              "
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Only lowercase letters, numbers, and hyphens allowed
          </p>
        </div>

        {/* Team Color */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Lab Color
            </span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ACADEMIC_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setPrimaryColor(color.value)}
                className={`
                  relative h-12 rounded-lg transition-all
                  ${primaryColor === color.value
                    ? 'ring-2 ring-offset-2 ring-[#2c5282] dark:ring-[#c9a227] dark:ring-offset-gray-900'
                    : 'hover:scale-105'
                  }
                `}
                style={{ backgroundColor: color.value }}
                aria-label={`Select ${color.name} color`}
                title={color.name}
              >
                {primaryColor === color.value && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Check className="w-5 h-5 text-white drop-shadow-md" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Selected:
            </span>
            <div
              className="w-6 h-6 rounded border border-gray-200 dark:border-gray-600"
              style={{ backgroundColor: primaryColor }}
            />
            <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
              {primaryColor}
            </span>
          </div>
        </div>

        {/* Delete (Deactivate) Team Section */}
        {canDeleteTeam && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            {!showDeleteConfirm ? (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Deactivate Lab
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Deactivate this lab. Members will lose access, but data is preserved for potential reactivation.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="mt-3"
                  >
                    Deactivate Lab
                  </Button>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <h3 className="font-medium text-red-800 dark:text-red-200">
                    Confirm Deactivation
                  </h3>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                  Type <strong>{currentTeam?.name}</strong> to confirm deactivation:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type lab name..."
                  className="
                    w-full px-3 py-2 rounded-lg mb-3
                    bg-white dark:bg-gray-800
                    border border-red-300 dark:border-red-700
                    text-gray-900 dark:text-white
                    placeholder-gray-400 dark:placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-red-500
                  "
                />
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    loading={isDeleting}
                    disabled={deleteConfirmText !== currentTeam?.name}
                  >
                    Deactivate Lab
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isSaving}
        >
          <X className="w-4 h-4" />
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          loading={isSaving}
          disabled={!hasChanges}
        >
          <Check className="w-4 h-4" />
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default TeamSettingsModal;
