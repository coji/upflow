import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Account = {
    id: string;
    accountId: string;
    providerId: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    scope: string | null;
    password: string | null;
    createdAt: string;
    updatedAt: string;
};
export type Company = {
    id: string;
    name: string;
    releaseDetectionMethod: Generated<string>;
    releaseDetectionKey: Generated<string>;
    updatedAt: string;
    createdAt: Generated<string>;
    isActive: Generated<number>;
};
export type CompanyGithubUser = {
    companyId: string;
    userId: string | null;
    login: string;
    name: string | null;
    email: string | null;
    pictureUrl: string | null;
    displayName: string;
    updatedAt: string;
    createdAt: Generated<string>;
};
export type ExportSetting = {
    id: string;
    companyId: string;
    sheetId: string;
    clientEmail: string;
    privateKey: string;
    updatedAt: string;
    createdAt: Generated<string>;
};
export type Integration = {
    id: string;
    provider: string;
    method: string;
    privateToken: string | null;
    companyId: string;
};
export type Invitation = {
    id: string;
    organizationId: string;
    email: string;
    role: string | null;
    status: string;
    expiresAt: string;
    inviterId: string;
};
export type Member = {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: string;
};
export type Organization = {
    id: string;
    name: string;
    slug: string | null;
    logo: string | null;
    createdAt: Generated<string>;
    metadata: string | null;
};
export type PullRequest = {
    repo: string;
    number: number;
    sourceBranch: string;
    targetBranch: string;
    state: string;
    author: string;
    title: string;
    url: string;
    firstCommittedAt: string | null;
    pullRequestCreatedAt: string;
    firstReviewedAt: string | null;
    mergedAt: string | null;
    releasedAt: string | null;
    codingTime: number | null;
    pickupTime: number | null;
    reviewTime: number | null;
    deployTime: number | null;
    totalTime: number | null;
    repositoryId: string;
    updatedAt: string | null;
};
export type Repository = {
    id: string;
    companyId: string;
    integrationId: string;
    provider: string;
    owner: string;
    repo: string;
    releaseDetectionMethod: Generated<string>;
    releaseDetectionKey: Generated<string>;
    updatedAt: string;
    createdAt: Generated<string>;
};
export type Session = {
    id: string;
    expiresAt: string;
    token: string;
    createdAt: string;
    updatedAt: string;
    ipAddress: string | null;
    userAgent: string | null;
    userId: string;
    impersonatedBy: string | null;
    activeOrganizationId: string | null;
};
export type User = {
    id: string;
    name: string;
    email: string;
    emailVerified: number;
    image: string | null;
    role: string;
    banned: number | null;
    banReason: string | null;
    banExpires: string | null;
    createdAt: Generated<string>;
    updatedAt: string;
};
export type Verification = {
    id: string;
    identifier: string;
    value: string;
    expiresAt: string;
    createdAt: string | null;
    updatedAt: string | null;
};
export type DB = {
    accounts: Account;
    companies: Company;
    companyGithubUsers: CompanyGithubUser;
    exportSettings: ExportSetting;
    integrations: Integration;
    invitations: Invitation;
    members: Member;
    organizations: Organization;
    pullRequests: PullRequest;
    repositories: Repository;
    sessions: Session;
    users: User;
    verifications: Verification;
};
