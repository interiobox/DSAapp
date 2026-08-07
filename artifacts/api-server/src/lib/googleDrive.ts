import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { db, drawingsTable, googleDriveConnectionsTable } from "@workspace/db";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "Drawing Library";
const DELETED_DRAWINGS_FOLDER_NAME = "Deleted Drawings";
const UNCATEGORIZED_FOLDER_NAME = "Uncategorized";

type GoogleOAuthConfig = {
  client_id: string;
  client_secret: string;
  auth_uri: string;
  token_uri: string;
};

type DriveFile = {
  id: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
};

function getEncryptionKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set to protect Google Drive tokens.");
  return createHash("sha256").update(`${secret}:google-drive`).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string) {
  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) throw new Error("Invalid encrypted Google Drive token.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
}

function getOAuthConfig(): GoogleOAuthConfig {
  const raw = process.env.GOOGLE_OAUTH_CLIENT_JSON;
  if (!raw) throw new Error("GOOGLE_OAUTH_CLIENT_JSON is not configured.");
  const parsed = JSON.parse(raw) as { web?: GoogleOAuthConfig; installed?: GoogleOAuthConfig } & GoogleOAuthConfig;
  const config = parsed.web ?? parsed.installed ?? parsed;
  if (!config.client_id || !config.client_secret || !config.auth_uri || !config.token_uri) {
    throw new Error("GOOGLE_OAUTH_CLIENT_JSON is missing required OAuth fields.");
  }
  return config;
}

export function getGoogleDriveRedirectUri(origin: string) {
  return process.env.GOOGLE_DRIVE_REDIRECT_URI
    ?? new URL("/api/admin/google-drive/oauth/callback", origin).toString();
}

function createOAuthClient(redirectUri?: string) {
  const config = getOAuthConfig();
  return new OAuth2Client(config.client_id, config.client_secret, redirectUri);
}

function signState(payload: { userId: number; redirectUri: string; expiresAt: number }) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set to sign Google Drive OAuth state.");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyGoogleDriveState(state: string) {
  const [encoded, signature] = state.split(".");
  const secret = process.env.SESSION_SECRET;
  if (!encoded || !signature || !secret) throw new Error("Invalid Google Drive OAuth state.");
  const expected = createHmac("sha256", secret).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid Google Drive OAuth state signature.");
  }
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
    userId: number;
    redirectUri: string;
    expiresAt: number;
  };
  if (!payload.userId || !payload.redirectUri || payload.expiresAt < Date.now()) {
    throw new Error("Expired Google Drive OAuth state.");
  }
  return payload;
}

export function createGoogleDriveAuthorizationUrl(userId: number, redirectUri: string) {
  const client = createOAuthClient(redirectUri);
  const state = signState({ userId, redirectUri, expiresAt: Date.now() + 10 * 60 * 1000 });
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"],
    state,
  });
}

async function getConnection() {
  const [connection] = await db.select().from(googleDriveConnectionsTable).where(eq(googleDriveConnectionsTable.id, 1)).limit(1);
  return connection ?? null;
}

export async function getGoogleDriveStatus() {
  const connection = await getConnection();
  return {
    provider: connection ? "google_drive" as const : "object_storage" as const,
    connected: Boolean(connection),
    accountEmail: connection?.accountEmail ?? null,
    displayName: connection?.displayName ?? null,
    rootFolderId: connection?.rootFolderId ?? null,
  };
}

async function getAuthorizedClient() {
  const connection = await getConnection();
  if (!connection) return null;
  const client = createOAuthClient();
  client.setCredentials({
    refresh_token: decrypt(connection.refreshTokenEncrypted),
    ...(connection.accessTokenEncrypted ? { access_token: decrypt(connection.accessTokenEncrypted) } : {}),
    ...(connection.accessTokenExpiresAt ? { expiry_date: connection.accessTokenExpiresAt.getTime() } : {}),
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Google Drive access token could not be refreshed.");
  const credentials = client.credentials;
  if (credentials.access_token && credentials.access_token !== (connection.accessTokenEncrypted ? decrypt(connection.accessTokenEncrypted) : null)) {
    await db.update(googleDriveConnectionsTable).set({
      accessTokenEncrypted: encrypt(credentials.access_token),
      accessTokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      updatedAt: new Date(),
    }).where(eq(googleDriveConnectionsTable.id, 1));
  }
  return { client, connection, accessToken: token.token };
}

async function driveFetch(accessToken: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers });
}

async function driveJson<T>(accessToken: string, url: string, init?: RequestInit): Promise<T> {
  const response = await driveFetch(accessToken, url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Google Drive request failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  return await response.json() as T;
}

function escapeDriveQueryValue(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

async function findFolder(accessToken: string, parentId: string, name: string) {
  const query = `'${escapeDriveQueryValue(parentId)}' in parents and name = '${escapeDriveQueryValue(name)}' and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false`;
  const params = new URLSearchParams({ q: query, fields: "files(id,name)", pageSize: "1" });
  const result = await driveJson<{ files?: DriveFile[] }>(accessToken, `${DRIVE_API}/files?${params}`);
  return result.files?.[0]?.id ?? null;
}

async function folderExists(accessToken: string, folderId: string) {
  try {
    const file = await driveJson<DriveFile>(accessToken, `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,mimeType,trashed`);
    return file.mimeType === DRIVE_FOLDER_MIME && file.trashed !== true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("(404)")) return false;
    throw error;
  }
}

async function createFolder(accessToken: string, parentId: string, name: string) {
  return (await driveJson<DriveFile>(accessToken, `${DRIVE_API}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: DRIVE_FOLDER_MIME, parents: [parentId] }),
  })).id;
}

async function ensureFolder(accessToken: string, parentId: string, name: string) {
  return await findFolder(accessToken, parentId, name) ?? await createFolder(accessToken, parentId, name);
}

export function normalizeDriveCategory(category?: string | null) {
  return category?.trim() || UNCATEGORIZED_FOLDER_NAME;
}

async function ensureRootFolders(accessToken: string) {
  const existingConnection = await getConnection();
  let rootFolderId: string | undefined = existingConnection?.rootFolderId ?? undefined;
  if (!rootFolderId || !(await folderExists(accessToken, rootFolderId))) {
    rootFolderId = (await findFolder(accessToken, "root", ROOT_FOLDER_NAME)) ?? undefined;
  }
  if (!rootFolderId) {
    rootFolderId = await createFolder(accessToken, "root", ROOT_FOLDER_NAME);
  }
  await ensureFolder(accessToken, rootFolderId, DELETED_DRAWINGS_FOLDER_NAME);
  return { rootFolderId };
}

async function ensureConnectedRoot(accessToken: string, connection: Awaited<ReturnType<typeof getConnection>>) {
  const { rootFolderId } = await ensureRootFolders(accessToken);
  if (connection && connection.rootFolderId !== rootFolderId) {
    await db.update(googleDriveConnectionsTable).set({
      rootFolderId,
      updatedAt: new Date(),
    }).where(eq(googleDriveConnectionsTable.id, connection.id));
  }
  return rootFolderId;
}

export async function completeGoogleDriveConnection(code: string, redirectUri: string, userId: number) {
  const client = createOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token. Try connecting again.");
  client.setCredentials(tokens);
  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) throw new Error("Google Drive access token was not returned.");
  const profile = await driveJson<{ email?: string; name?: string }>(accessToken, "https://www.googleapis.com/oauth2/v3/userinfo");
  const { rootFolderId } = await ensureRootFolders(accessToken);
  await db.insert(googleDriveConnectionsTable).values({
    id: 1,
    accountEmail: profile.email ?? null,
    displayName: profile.name ?? null,
    refreshTokenEncrypted: encrypt(tokens.refresh_token),
    accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token) : null,
    accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    rootFolderId,
    createdByUserId: userId,
    updatedAt: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      accountEmail: profile.email ?? null,
      displayName: profile.name ?? null,
      refreshTokenEncrypted: encrypt(tokens.refresh_token),
      accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token) : null,
      accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      rootFolderId,
      createdByUserId: userId,
      updatedAt: new Date(),
    },
  });
}

export async function disconnectGoogleDrive() {
  await db.delete(googleDriveConnectionsTable).where(eq(googleDriveConnectionsTable.id, 1));
}

export async function uploadDrawingToGoogleDrive(input: {
  projectName: string;
  category: string;
  drawingNumber: string;
  drawingTitle: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}) {
  const authorized = await getAuthorizedClient();
  if (!authorized) return null;
  const rootFolderId = await ensureConnectedRoot(authorized.accessToken, authorized.connection);
  const projectFolder = await ensureFolder(authorized.accessToken, rootFolderId, input.projectName);
  const categoryFolder = await ensureFolder(authorized.accessToken, projectFolder, normalizeDriveCategory(input.category));
  const drawingFolder = await ensureFolder(authorized.accessToken, categoryFolder, `${input.drawingNumber} - ${input.drawingTitle}`);
  const metadata = { name: input.fileName, parents: [drawingFolder] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([new Uint8Array(input.body)], { type: input.contentType }), input.fileName);
  const response = await driveFetch(authorized.accessToken, `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}).`);
  return await response.json() as DriveFile;
}

export async function uploadGalleryMediaToGoogleDrive(input: {
  projectName: string;
  albumName: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}) {
  const authorized = await getAuthorizedClient();
  if (!authorized) return null;
  const rootFolderId = await ensureConnectedRoot(authorized.accessToken, authorized.connection);
  const projectFolder = await ensureFolder(authorized.accessToken, rootFolderId, input.projectName);
  const albumFolder = await ensureFolder(authorized.accessToken, projectFolder, input.albumName);
  const metadata = { name: input.fileName, parents: [albumFolder] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([new Uint8Array(input.body)], { type: input.contentType }), input.fileName);
  const response = await driveFetch(authorized.accessToken, `${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(`Google Drive upload failed (${response.status}).`);
  return await response.json() as DriveFile;
}

async function ensureDrawingFolder(accessToken: string, rootFolderId: string, input: {
  projectName: string;
  category: string;
  drawingNumber: string;
  drawingTitle: string;
}, deleted: boolean) {
  const parent = deleted
    ? await ensureFolder(accessToken, rootFolderId, DELETED_DRAWINGS_FOLDER_NAME)
    : rootFolderId;
  const projectFolder = await ensureFolder(accessToken, parent, input.projectName);
  const categoryFolder = await ensureFolder(accessToken, projectFolder, normalizeDriveCategory(input.category));
  return await ensureFolder(accessToken, categoryFolder, `${input.drawingNumber} - ${input.drawingTitle}`);
}

export async function moveDriveFileToDrawingFolder(fileId: string, input: {
  projectName: string;
  category: string;
  drawingNumber: string;
  drawingTitle: string;
}, deleted = false) {
  const authorized = await getAuthorizedClient();
  if (!authorized) return null;
  const rootFolderId = await ensureConnectedRoot(authorized.accessToken, authorized.connection);
  const targetFolderId = await ensureDrawingFolder(authorized.accessToken, rootFolderId, input, deleted);
  const metadata = await driveJson<DriveFile>(
    authorized.accessToken,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,parents`,
  );
  const currentParents = metadata.parents?.filter((parent) => parent !== targetFolderId) ?? [];
  const params = new URLSearchParams({
    addParents: targetFolderId,
    fields: "id,name,mimeType,webViewLink,webContentLink,size,createdTime,modifiedTime,parents",
  });
  if (currentParents.length > 0) params.set("removeParents", currentParents.join(","));
  return await driveJson<DriveFile>(
    authorized.accessToken,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params}`,
    { method: "PATCH" },
  );
}

export async function downloadDriveFile(fileId: string) {
  const authorized = await getAuthorizedClient();
  if (!authorized) return null;
  const metadata = await driveJson<DriveFile>(authorized.accessToken, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`);
  const response = await driveFetch(authorized.accessToken, `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`);
  if (!response.ok || !response.body) throw new Error(`Google Drive download failed (${response.status}).`);
  return { metadata, response };
}

export async function deleteDriveFile(fileId: string) {
  const authorized = await getAuthorizedClient();
  if (!authorized) return;
  const response = await driveFetch(authorized.accessToken, `${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  if (!response.ok && response.status !== 404) throw new Error(`Google Drive delete failed (${response.status}).`);
}

export function isDriveFilePath(filePath: string) {
  return filePath.startsWith("/drive/files/");
}

export function getDriveFileId(filePath: string) {
  return filePath.slice("/drive/files/".length);
}

export function getGoogleDriveOAuthErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Google Drive authorization failed.";
}