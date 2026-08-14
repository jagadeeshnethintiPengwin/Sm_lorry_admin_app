import { API_ORIGIN, apiClient } from './api.client';

/**
 * Sending a picked file to the server.
 *
 * Every document slot in this app used to record a made-up filename —
 * `photo.jpg`, `scan.jpg`, `RC-photo.jpg` and a fabricated `1.2 MB` — chosen
 * by the screen the moment the source sheet was tapped. No picker ever opened,
 * no bytes ever moved, and the tile turned gold regardless. A vehicle could be
 * added to the fleet claiming an RC and an insurance certificate were on file
 * when nothing had been attached at all.
 *
 * This is the part that was missing between the picker and the document
 * record: the bytes go up, and the URL that comes back is what belongs in
 * `fileUrl`.
 */

export type UploadedFile = {
  url: string;
  filename: string;
  size: number;
  mimetype: string;
};

/** What the picker hands over — the shape of `PickedImage`. */
export type Uploadable = {
  uri: string;
  fileName: string;
  type: string;
};

export const uploadService = {
  /**
   * `POST /uploads` — stores one file and answers with its URL.
   *
   * Two things here are easy to get wrong and both fail quietly.
   *
   * The address is the API root rather than the `admin/v1` surface the rest of
   * this client talks to: uploads are shared by all three apps. So it is given
   * as an absolute URL, which axios uses in place of the `baseURL`.
   *
   * And `Content-Type` must be left for the runtime to fill in. A multipart
   * body is split on a boundary string that only the sender can generate, and
   * this client sets `application/json` on every request by default — which
   * would arrive as a body the server cannot parse and a "no file received"
   * that names nothing.
   */
  async upload(file: Uploadable): Promise<UploadedFile> {
    const form = new FormData();
    /*
     * React Native's `FormData` takes this shape rather than a `Blob`; the
     * cast is what the platform's own types require here.
     */
    form.append('file', {
      uri: file.uri,
      name: file.fileName,
      type: file.type,
    } as unknown as Blob);

    const { data } = await apiClient.post<UploadedFile>(
      `${API_ORIGIN}/uploads`,
      form,
      {
        // Undefined, not omitted: this deletes the client's JSON default so
        // the runtime can write the boundary in.
        headers: { 'Content-Type': undefined },
        // A scan over a patchy office connection needs longer than a JSON call.
        timeout: 60_000,
      },
    );
    return data;
  },
};
