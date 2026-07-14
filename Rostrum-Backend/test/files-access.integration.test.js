const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const env = require('../src/config/env');
const app = require('../src/app');
const db = require('../src/config/db');
const PresentationModel = require('../src/models/presentation.model');
const { generateToken } = require('../src/utils/jwt');

const originalModelMethods = {};
const ownerToken = generateToken({ user_id: 101, email: 'owner@example.test' });
const strangerToken = generateToken({ user_id: 202, email: 'stranger@example.test' });
const fixtureDirectory = path.resolve(env.upload.slideImageDir, '.integration-files-access');
const imagePath = path.join(fixtureDirectory, 'slide-1.svg');
const nonImagePath = path.join(fixtureDirectory, 'secret.txt');
const outsidePath = path.resolve(env.upload.slideImageDir, '..', '.outside-slide.svg');
let baseUrl;
let server;

function authorization(token) {
  return { Authorization: `Bearer ${token}` };
}

test.before(async () => {
  await fs.mkdir(fixtureDirectory, { recursive: true });
  await fs.writeFile(imagePath, '<svg xmlns="http://www.w3.org/2000/svg"><text>private</text></svg>');
  await fs.writeFile(nonImagePath, 'must never be served');
  await fs.writeFile(outsidePath, '<svg xmlns="http://www.w3.org/2000/svg"><text>outside</text></svg>');

  for (const method of ['findById', 'findByUser', 'getSlides', 'findSlideByIndex']) {
    originalModelMethods[method] = PresentationModel[method];
  }

  PresentationModel.findById = async id => ({
    id,
    user_id: 101,
    title: `Presentation ${id}`,
    file_path: 'C:\\private\\storage\\secret.pptx',
    slide_count: 1,
  });
  PresentationModel.findByUser = async userId => [{
    id: 1,
    user_id: userId,
    title: 'Private presentation',
    file_path: 'C:\\private\\storage\\secret.pptx',
    slide_count: 1,
  }];
  PresentationModel.getSlides = async () => [{
    id: 11,
    presentation_id: 1,
    slide_index: 1,
    extracted_text: 'Visible slide text',
    key_phrases: ['visible'],
    image_path: imagePath,
  }];
  PresentationModel.findSlideByIndex = async presentationId => ({
    id: 11,
    presentation_id: presentationId,
    slide_index: 1,
    image_path: presentationId === 2 ? outsidePath : presentationId === 3 ? nonImagePath : imagePath,
  });

  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  Object.assign(PresentationModel, originalModelMethods);
  await fs.rm(fixtureDirectory, { recursive: true, force: true });
  await fs.rm(outsidePath, { force: true });
  await db.end();
});

test('file routes reject anonymous and non-owner requests', async () => {
  const anonymous = await fetch(`${baseUrl}/api/presentations/1/slides/1/image`);
  assert.equal(anonymous.status, 401);

  const stranger = await fetch(`${baseUrl}/api/presentations/1/slides/1/image`, {
    headers: authorization(strangerToken),
  });
  assert.equal(stranger.status, 403);
  assert.match(stranger.headers.get('content-type'), /application\/json/);
});

test('owner receives a private non-cacheable slide image', async () => {
  const response = await fetch(`${baseUrl}/api/presentations/1/slides/1/image`, {
    headers: authorization(ownerToken),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^image\/svg\+xml/);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('content-disposition'), 'inline');
  assert.match(await response.text(), /private/);
});

test('API never exposes physical file and image paths', async () => {
  const options = { headers: authorization(ownerToken) };
  const list = await (await fetch(`${baseUrl}/api/presentations`, options)).json();
  const details = await (await fetch(`${baseUrl}/api/presentations/1`, options)).json();
  const slides = await (await fetch(`${baseUrl}/api/presentations/1/slides`, options)).json();

  assert.equal('file_path' in list.presentations[0], false);
  assert.equal('file_path' in details.presentation, false);
  assert.equal('file_path' in slides.presentation, false);
  assert.equal('image_path' in slides.slides[0], false);
  assert.equal(slides.slides[0].image_url, '/presentations/1/slides/1/image');
});

test('direct upload URLs and database paths outside the image root are denied', async () => {
  const direct = await fetch(`${baseUrl}/uploads/.integration-files-access/slide-1.svg`, {
    headers: authorization(ownerToken),
  });
  assert.equal(direct.status, 404);

  const escaped = await fetch(`${baseUrl}/api/presentations/2/slides/1/image`, {
    headers: authorization(ownerToken),
  });
  assert.equal(escaped.status, 404);
  assert.match(escaped.headers.get('content-type'), /application\/json/);

  const wrongType = await fetch(`${baseUrl}/api/presentations/3/slides/1/image`, {
    headers: authorization(ownerToken),
  });
  assert.equal(wrongType.status, 404);
});

test('upload rejects a valid MIME type paired with a forbidden extension', async () => {
  const form = new FormData();
  form.append('presentation', new Blob(['not a pdf'], { type: 'application/pdf' }), 'payload.exe');
  const response = await fetch(`${baseUrl}/api/presentations`, {
    method: 'POST',
    headers: authorization(ownerToken),
    body: form,
  });

  assert.equal(response.status, 400);
});
