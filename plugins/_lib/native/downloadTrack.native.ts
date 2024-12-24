import { ManifestMimeType, type ExtendedPlayackInfo } from "../Caches/PlaybackInfoTypes";
import { rejectNotOk, toBuffer, type DownloadProgress } from "./request/helpers.native";
import { requestTrackStream } from "./request/requestTrack.native";
import { createWriteStream } from "fs";
import { mkdir, stat } from "fs/promises";
import path from "path";

import { FlacStreamTagger, PictureType } from "flac-stream-tagger";
import { requestStream } from "./request/requestStream.native";

import type { MetaTags } from "../makeTags";
import type { Readable } from "stream";

export type { DownloadProgress } from "./request/helpers.native";

const addTags = async (extPlaybackInfo: ExtendedPlayackInfo, stream: Readable, metaTags?: MetaTags) => {
	if (metaTags === undefined) return stream;
	const { tags, coverUrl } = metaTags;
	if (extPlaybackInfo.manifestMimeType === ManifestMimeType.Tidal) {
		switch (extPlaybackInfo.manifest.codecs) {
			case "flac": {
				let picture;
				if (coverUrl !== undefined) {
					try {
						picture = {
							pictureType: PictureType.FrontCover,
							buffer: await requestStream(coverUrl).then(rejectNotOk).then(toBuffer),
						};
					} catch {}
				}
				return stream.pipe(
					new FlacStreamTagger({
						tagMap: tags,
						picture,
					})
				);
			}
		}
	}
	return stream;
};

const exists = (path: string): Promise<boolean> =>
	stat(path)
		.catch(() => false)
		.then(() => true);

export type PathInfo = {
	fileName?: string;
	folderPath: string;
	basePath?: string;
};

const pathSeparator = process.platform === "win32" ? "\\" : "/";

const downloadStatus: Record<string, DownloadProgress> = {};
export const startTrackDownload = async (extPlaybackInfo: ExtendedPlayackInfo, pathInfo: PathInfo, metaTags?: MetaTags): Promise<void> => {
	const pathKey = JSON.stringify(pathInfo);
	if (downloadStatus[pathKey] !== undefined) throw new Error(`Something is already downloading to ${pathKey}`);
	try {
		const folderPath = path.join(pathInfo.basePath ?? "", pathInfo.folderPath);
		if (folderPath !== ".") await mkdir(folderPath, { recursive: true });
		const fileName = `${folderPath}${pathSeparator}${pathInfo.fileName}`;
		// Dont download if exists
		if (await exists(fileName)) {
			delete downloadStatus[pathKey];
			return Promise.resolve();
		}
		const stream = await requestTrackStream(extPlaybackInfo, { onProgress: (progress) => (downloadStatus[pathKey] = progress) });
		const metaStream = await addTags(extPlaybackInfo, stream, metaTags);
		const writeStream = createWriteStream(fileName);
		return new Promise((res, rej) =>
			metaStream
				.pipe(writeStream)
				.on("finish", () => {
					delete downloadStatus[pathKey];
					res();
				})
				.on("error", rej)
		);
	} catch (err) {
		delete downloadStatus[pathKey];
		throw err;
	}
};
export const getDownloadProgress = (filePath: string) => downloadStatus[filePath];
