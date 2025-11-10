export interface InviteMemberData {
  email: string;
  projectId: string;
  role: string;
}

export interface AddMemberData {
  userId: string;
  projectId: string;
  role: string;
}

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  role: string;
  joinedAt: string;
  createdAt?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    username: string;
    status: string;
    avatar: string;
    lastLoginAt: string;
    avatarUrl?: string;
  };
}
