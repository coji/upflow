import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Company = {
    id: string;
    name: string;
    release_detection_method: Generated<string>;
    release_detection_key: Generated<string>;
    updated_at: string;
    created_at: Generated<string>;
    is_active: Generated<number>;
};
export type CompanyUser = {
    company_id: string;
    user_id: string;
    role: string;
    invited_at: string | null;
    activated_at: string | null;
    updated_at: string;
    created_at: Generated<string>;
};
export type ExportSetting = {
    id: string;
    company_id: string;
    sheet_id: string;
    client_email: string;
    private_key: string;
    updated_at: string;
    created_at: Generated<string>;
};
export type Integration = {
    id: string;
    provider: string;
    method: string;
    private_token: string | null;
    company_id: string;
};
export type PullRequest = {
    repo: string;
    number: number;
    source_branch: string;
    target_branch: string;
    state: string;
    author: string;
    title: string;
    url: string;
    first_committed_at: string | null;
    pull_request_created_at: string;
    first_reviewed_at: string | null;
    merged_at: string | null;
    released_at: string | null;
    coding_time: number | null;
    pickup_time: number | null;
    review_time: number | null;
    deploy_time: number | null;
    total_time: number | null;
    repository_id: string;
    updated_at: string | null;
};
export type Repository = {
    id: string;
    integration_id: string;
    provider: string;
    name: Generated<string>;
    project_id: string | null;
    owner: string | null;
    repo: string | null;
    release_detection_method: Generated<string>;
    release_detection_key: Generated<string>;
    company_id: string;
};
export type Team = {
    id: string;
    name: string;
    updated_at: string;
    created_at: Generated<string>;
    company_id: string;
};
export type TeamRepository = {
    team_id: string;
    repository_id: string;
    updated_at: string;
    created_at: Generated<string>;
};
export type TeamUser = {
    team_id: string;
    user_id: string;
    role: string;
    updated_at: string;
    created_at: Generated<string>;
};
export type User = {
    id: string;
    email: string;
    display_name: string;
    picture_url: string | null;
    locale: string;
    role: Generated<string>;
    updated_at: string;
    created_at: Generated<string>;
};
export type DB = {
    companies: Company;
    company_users: CompanyUser;
    export_settings: ExportSetting;
    integrations: Integration;
    pull_requests: PullRequest;
    repositories: Repository;
    team_repositories: TeamRepository;
    team_users: TeamUser;
    teams: Team;
    users: User;
};
