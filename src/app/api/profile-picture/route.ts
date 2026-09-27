import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { getDotsProfileBucket, getMrGymAdminServices } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

async function getAuthorizedAdminUid(request: Request): Promise<string | Response> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return jsonError('Authentication is required.', 401);
  }

  const idToken = authorization.slice('Bearer '.length).trim();
  const { auth, db } = getMrGymAdminServices();

  let uid: string;
  try {
    const decodedToken = await auth.verifyIdToken(idToken, true);
    uid = decodedToken.uid;
  } catch {
    return jsonError('The login session is invalid or expired.', 401);
  }

  const adminSnapshot = await db.collection('admins').doc(uid).get();
  if (!adminSnapshot.exists || adminSnapshot.data()?.active === false) {
    return jsonError('Administrative access is required.', 403);
  }

  return uid;
}

export async function GET(request: Request) {
  try {
    const authorization = await getAuthorizedAdminUid(request);
    if (authorization instanceof Response) return authorization;

    const objectPath = new URL(request.url).searchParams.get('path')?.trim();
    const allowedPrefix = 'public/images/mr-gym/profile-pictures/';
    if (
      !objectPath ||
      objectPath.length > 512 ||
      !objectPath.startsWith(allowedPrefix) ||
      objectPath.includes('..')
    ) {
      return jsonError('The profile-picture path is invalid.', 400);
    }

    const object = getDotsProfileBucket().file(objectPath);
    const [metadata] = await object.getMetadata();
    const contentType = metadata.contentType || '';
    const size = Number(metadata.size || 0);
    if (!ALLOWED_TYPES.has(contentType) || size <= 0 || size > MAX_IMAGE_BYTES) {
      return jsonError('The stored profile picture is invalid.', 400);
    }

    const [imageBuffer] = await object.download();
    return new Response(new Uint8Array(imageBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const statusCode = (error as { code?: number }).code;
    if (statusCode === 404) return jsonError('The profile picture was not found.', 404);
    console.error('Profile-picture download failed:', error);
    return jsonError('The profile picture could not be loaded for the PDF.', 500);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await getAuthorizedAdminUid(request);
    if (authorization instanceof Response) return authorization;
    const uid = authorization;

    const formData = await request.formData();
    const image = formData.get('image');
    const memberIdValue = formData.get('memberId');
    const memberId = typeof memberIdValue === 'string' ? memberIdValue.trim() : '';

    if (!(image instanceof File)) {
      return jsonError('Select an image to upload.', 400);
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(memberId)) {
      return jsonError('The member identifier is invalid.', 400);
    }
    if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
      return jsonError('The image must be between 1 byte and 5 MB.', 400);
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const detectedType = await fileTypeFromBuffer(imageBuffer);
    const extension = detectedType ? ALLOWED_TYPES.get(detectedType.mime) : undefined;
    if (!detectedType || !extension) {
      return jsonError('Only valid JPEG, PNG, and WebP images are allowed.', 400);
    }

    const bucket = getDotsProfileBucket();
    const objectPath = `public/images/mr-gym/profile-pictures/${memberId}/${randomUUID()}.${extension}`;
    const downloadToken = randomUUID();
    const object = bucket.file(objectPath);

    await object.save(imageBuffer, {
      resumable: false,
      validation: 'crc32c',
      metadata: {
        contentType: detectedType.mime,
        cacheControl: 'public, max-age=31536000, immutable',
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedBy: uid,
          source: 'mr-gym-admin',
        },
      },
    });

    const encodedPath = encodeURIComponent(objectPath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return Response.json({ url, path: objectPath }, { status: 201 });
  } catch (error) {
    console.error('Profile-picture upload failed:', error);
    return jsonError('The profile picture could not be uploaded.', 500);
  }
}
