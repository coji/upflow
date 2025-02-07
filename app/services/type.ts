import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

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
export type CompanyUser = {
    companyId: string;
    userId: string;
    role: string;
    invitedAt: string | null;
    activatedAt: string | null;
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
export type Team = {
    id: string;
    name: string;
    updatedAt: string;
    createdAt: Generated<string>;
    companyId: string;
};
export type TeamRepository = {
    teamId: string;
    repositoryId: string;
    updatedAt: string;
    createdAt: Generated<string>;
};
export type TeamUser = {
    teamId: string;
    userId: string;
    role: string;
    updatedAt: string;
    createdAt: Generated<string>;
};
export type User = {
    id: string;
    email: string;
    displayName: string;
    pictureUrl: string | null;
    locale: string;
    role: Generated<string>;
    updatedAt: string;
    createdAt: Generated<string>;
};
export type DB = {
    companies: Company;
    companyGithubUsers: CompanyGithubUser;
    companyUsers: CompanyUser;
    exportSettings: ExportSetting;
    integrations: Integration;
    pullRequests: PullRequest;
    repositories: Repository;
    teamRepositories: TeamRepository;
    teamUsers: TeamUser;
    teams: Team;
    users: User;
};
