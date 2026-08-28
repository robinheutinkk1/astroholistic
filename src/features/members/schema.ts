import { z } from 'zod';

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .min(1, 'Vul een e-mailadres in.')
    .email('Dat lijkt geen geldig e-mailadres.')
    .transform((value) => value.trim().toLowerCase()),
  roleIds: z.array(z.uuid()).min(1, 'Kies minimaal één rol.'),
});

export const updateMemberRolesSchema = z.object({
  membershipId: z.uuid(),
  roleIds: z.array(z.uuid()).min(1, 'Een lid moet minimaal één rol houden.'),
});

export const setMemberStatusSchema = z.object({
  membershipId: z.uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED']),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRolesInput = z.infer<typeof updateMemberRolesSchema>;
export type SetMemberStatusInput = z.infer<typeof setMemberStatusSchema>;
