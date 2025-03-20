import { requestJson } from "@inrixia/lib/native/request/requestJson.native.js";
import type { Payload } from "./ListenBrainzTypes.js";
import { settings } from "./Settings";

type NowPlayingPayload = Omit<Payload, "listened_at">;

export class ListenBrainz {
	private static async sendRequest(body?: { listen_type: "single" | "playing_now"; payload: Payload[] | NowPlayingPayload[] }) {
		if (settings.userToken === "") return;
		return requestJson(`https://maloja.sotga.de/apis/listenbrainz/1/submit-listens`, {
			headers: {
				"Content-type": "application/json",
				Accept: "application/json",
				Authorization: `Token ${settings.userToken}`,
			},
			method: "POST",
			body: JSON.stringify(body),
		});
	}

	public static updateNowPlaying(payload: NowPlayingPayload) {
		// @ts-expect-error Ensure this doesnt exist
		delete payload.listened_at;
		return this.sendRequest({
			listen_type: "playing_now",
			payload: [payload],
		});
	}

	public static scrobble(payload: Payload[]) {
		return this.sendRequest({
			listen_type: "single",
			payload,
		});
	}
}
