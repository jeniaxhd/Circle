import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Community APIs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerId: number;
  let memberId: number;
  let circleId: number;
  let otherCircleId: number;
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let postId: number;
  const userIds: number[] = [];
  const circleIds: number[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const suffix = randomUUID();
    const users = await prisma.$transaction(
      ['owner', 'member', 'outsider'].map((role) =>
        prisma.user.create({
          data: {
            name: 'Community test ' + role,
            email: 'community-' + role + '-' + suffix + '@example.invalid',
            passwordHash: 'unused-test-fixture-hash',
          },
        }),
      ),
    );
    userIds.push(...users.map((user) => user.id));
    ownerId = users[0].id;
    memberId = users[1].id;
    ownerToken = jwt.sign({ sub: ownerId });
    memberToken = jwt.sign({ sub: memberId });
    outsiderToken = jwt.sign({ sub: users[2].id });
    const circle = await prisma.circle.create({
      data: {
        name: 'Community test ' + suffix,
        memberships: {
          create: [
            { userId: ownerId, role: 'OWNER' },
            { userId: memberId, role: 'MEMBER' },
          ],
        },
      },
    });
    circleId = circle.id;
    circleIds.push(circleId);
    const other = await prisma.circle.create({
      data: {
        name: 'Other community test ' + suffix,
        memberships: { create: { userId: ownerId, role: 'OWNER' } },
      },
    });
    otherCircleId = other.id;
    circleIds.push(otherCircleId);
    const post = await prisma.post.create({
      data: { circleId, authorId: ownerId, text: 'Needle inside circle' },
    });
    postId = post.id;
    await prisma.post.create({
      data: {
        circleId: otherCircleId,
        authorId: ownerId,
        text: 'Needle in another circle',
      },
    });
  }, 20000);

  afterAll(async () => {
    try {
      if (prisma && circleIds.length)
        await prisma.circle.deleteMany({ where: { id: { in: circleIds } } });
      if (prisma && userIds.length)
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  it('creates, replaces, counts and removes only the requester reaction', async () => {
    const server = app.getHttpServer();
    const base = `/circles/${circleId}/posts/${postId}/reactions`;
    const initial = await request(server)
      .get(base)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(initial.body).toEqual({ reactions: [], myReaction: null });
    const created = await request(server)
      .post(base)
      .auth(ownerToken, { type: 'bearer' })
      .send({ emoji: '👍', authorId: memberId })
      .expect(201);
    const id = created.body.id;
    expect(created.body.authorId).toBe(ownerId);
    const changed = await request(server)
      .post(base)
      .auth(ownerToken, { type: 'bearer' })
      .send({ emoji: '❤️' })
      .expect(201);
    expect(changed.body.id).toBe(id);
    await Promise.all(
      Array.from({ length: 4 }, () =>
        request(server)
          .post(base)
          .auth(memberToken, { type: 'bearer' })
          .send({ emoji: '❤️' })
          .expect(201),
      ),
    );
    expect(await prisma.reaction.count({ where: { postId } })).toBe(2);
    const summary = await request(server)
      .get(base)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(summary.body).toEqual({
      reactions: [{ emoji: '❤️', _count: { _all: 2 } }],
      myReaction: { id, emoji: '❤️' },
    });
    await request(server)
      .delete(base + '/' + id)
      .auth(memberToken, { type: 'bearer' })
      .expect(404);
    await request(server)
      .delete(base + '/' + id)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    await request(server)
      .delete(base + '/' + id)
      .auth(ownerToken, { type: 'bearer' })
      .expect(404);
    const after = await request(server)
      .get(base)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(after.body).toEqual({
      reactions: [{ emoji: '❤️', _count: { _all: 1 } }],
      myReaction: null,
    });
  });

  it('protects reactions from unauthenticated users, outsiders and wrong-circle URLs', async () => {
    const postId = (
      await prisma.post.create({
        data: { circleId, authorId: ownerId, text: 'Reaction access fixture' },
      })
    ).id;

    const server = app.getHttpServer();
    const base = `/circles/${circleId}/posts/${postId}/reactions`;
    const wrong = `/circles/${otherCircleId}/posts/${postId}/reactions`;
    const reaction = await prisma.reaction.create({
      data: { postId, authorId: memberId, emoji: '❤️' },
    });
    for (const path of [base, wrong]) {
      for (const method of ['get', 'post', 'delete'] as const) {
        const url = path + (method === 'delete' ? '/' + reaction.id : '');
        await request(server)
          [method](url)
          .send(method === 'post' ? { emoji: '😂' } : undefined)
          .expect(401);
        await request(server)
          [method](url)
          .auth(outsiderToken, { type: 'bearer' })
          .send(method === 'post' ? { emoji: '😂' } : undefined)
          .expect(404);
        if (path === wrong)
          await request(server)
            [method](url)
            .auth(ownerToken, { type: 'bearer' })
            .send(method === 'post' ? { emoji: '😂' } : undefined)
            .expect(404);
      }
    }
    for (const emoji of [null, '', 123, 'x'.repeat(33)]) {
      await request(server)
        .post(base)
        .auth(ownerToken, { type: 'bearer' })
        .send({ emoji })
        .expect(400);
    }
    expect(await prisma.reaction.count({ where: { postId } })).toBe(1);
  });

  it('supports events, author permissions, RSVP changes and tenant isolation', async () => {
    const server = app.getHttpServer();
    const base = '/circles/' + circleId + '/events';
    await request(server).get(base).expect(401);
    const created = await request(server)
      .post(base)
      .auth(ownerToken, { type: 'bearer' })
      .send({
        title: 'Meetup',
        eventDate: '2027-01-10T12:00:00.000Z',
        authorId: memberId,
        circleId: otherCircleId,
      })
      .expect(201);
    const id = created.body.id as number;
    expect(created.body.authorId).toBe(ownerId);
    expect(created.body.circleId).toBe(circleId);
    expect(Object.keys(created.body.author).sort()).toEqual(['id', 'name']);
    const path = base + '/' + id;
    await request(server)
      .get(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    const listed = await request(server)
      .get(base)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(listed.body.some((event: { id: number }) => event.id === id)).toBe(
      true,
    );
    await request(server)
      .patch(path)
      .auth(memberToken, { type: 'bearer' })
      .send({ title: 'Forbidden' })
      .expect(403);
    await request(server)
      .delete(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .get(path)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    await request(server)
      .get('/circles/' + otherCircleId + '/events/' + id)
      .auth(ownerToken, { type: 'bearer' })
      .expect(404);
    const edited = await request(server)
      .patch(path)
      .auth(ownerToken, { type: 'bearer' })
      .send({ title: 'Renamed' })
      .expect(200);
    expect(edited.body.title).toBe('Renamed');
    const rsvp = path + '/rsvp';
    const parallel = await Promise.all(
      ['GOING', 'MAYBE'].map((status) =>
        request(server)
          .put(rsvp)
          .auth(memberToken, { type: 'bearer' })
          .send({ status }),
      ),
    );
    expect(parallel.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await prisma.eventAttendee.count({
        where: { eventId: id, userId: memberId },
      }),
    ).toBe(1);
    const going = await request(server)
      .put(rsvp)
      .auth(memberToken, { type: 'bearer' })
      .send({ status: 'GOING' })
      .expect(200);
    expect(going.body.status).toBe('GOING');
    const attendees = await request(server)
      .get(path + '/attendees')
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(attendees.body).toEqual([
      {
        userId: memberId,
        status: 'GOING',
        user: { id: memberId, name: 'Community test member' },
      },
    ]);
    await request(server)
      .put(rsvp)
      .auth(outsiderToken, { type: 'bearer' })
      .send({ status: 'GOING' })
      .expect(404);
    await request(server)
      .put('/circles/' + otherCircleId + '/events/' + id + '/rsvp')
      .auth(ownerToken, { type: 'bearer' })
      .send({ status: 'GOING' })
      .expect(404);
    await request(server)
      .put(rsvp)
      .auth(memberToken, { type: 'bearer' })
      .send({ status: 'INVALID' })
      .expect(400);
    await request(server)
      .delete(rsvp)
      .auth(memberToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .delete(rsvp)
      .auth(memberToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .delete(path)
      .auth(ownerToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .get(path)
      .auth(ownerToken, { type: 'bearer' })
      .expect(404);
    expect(await prisma.eventAttendee.count({ where: { eventId: id } })).toBe(
      0,
    );
  });

  it('supports memories, safe author fields, editing and author-only deletion', async () => {
    const server = app.getHttpServer();
    const base = '/circles/' + circleId + '/memories';
    await request(server).get(base).expect(401);
    const created = await request(server)
      .post(base)
      .auth(memberToken, { type: 'bearer' })
      .send({
        title: 'Trip',
        text: 'A story',
        imageUrl: 'https://example.com/trip.jpg',
        occurredAt: '2025-05-10T12:00:00.000Z',
        authorId: ownerId,
      })
      .expect(201);
    const id = created.body.id as number;
    const path = base + '/' + id;
    expect(created.body.authorId).toBe(memberId);
    expect(Object.keys(created.body.author).sort()).toEqual(['id', 'name']);
    await request(server)
      .get(path)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    const listed = await request(server)
      .get(base)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(listed.body.some((memory: { id: number }) => memory.id === id)).toBe(
      true,
    );
    await request(server)
      .patch(path)
      .auth(ownerToken, { type: 'bearer' })
      .send({ title: 'Forbidden' })
      .expect(403);
    await request(server)
      .delete(path)
      .auth(ownerToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .get(path)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    await request(server)
      .get('/circles/' + otherCircleId + '/memories/' + id)
      .auth(ownerToken, { type: 'bearer' })
      .expect(404);
    const edited = await request(server)
      .patch(path)
      .auth(memberToken, { type: 'bearer' })
      .send({ title: 'Updated trip', text: null, imageUrl: null })
      .expect(200);
    expect(edited.body.title).toBe('Updated trip');
    expect(edited.body.text).toBeNull();
    expect(edited.body.imageUrl).toBeNull();
    await request(server)
      .patch(path)
      .auth(memberToken, { type: 'bearer' })
      .send({ title: null })
      .expect(400);
    await request(server)
      .delete(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .get(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(404);
  });

  it('validates event and memory input and rejects writes to inaccessible circles', async () => {
    const server = app.getHttpServer();
    for (const payload of [
      { title: ' ', eventDate: '2027-01-10T12:00:00.000Z' },
      { title: 'Meetup', eventDate: 'not-a-date' },
      { title: 'Meetup', eventDate: null },
    ]) {
      await request(server)
        .post('/circles/' + circleId + '/events')
        .auth(ownerToken, { type: 'bearer' })
        .send(payload)
        .expect(400);
    }
    for (const payload of [
      { title: '', occurredAt: '2025-05-10T12:00:00.000Z' },
      { title: 'Trip', occurredAt: 'bad-date' },
      {
        title: 'Trip',
        occurredAt: '2025-05-10T12:00:00.000Z',
        imageUrl: 'file:///private/file',
      },
    ]) {
      await request(server)
        .post('/circles/' + circleId + '/memories')
        .auth(ownerToken, { type: 'bearer' })
        .send(payload)
        .expect(400);
    }
    await request(server)
      .post('/circles/' + circleId + '/events')
      .auth(outsiderToken, { type: 'bearer' })
      .send({ title: 'Forbidden', eventDate: '2027-01-10T12:00:00.000Z' })
      .expect(404);
    await request(server)
      .post('/circles/' + circleId + '/memories')
      .auth(outsiderToken, { type: 'bearer' })
      .send({ title: 'Forbidden', occurredAt: '2025-05-10T12:00:00.000Z' })
      .expect(404);
  });

  it('searches only the requested circle and treats SQL wildcard characters literally', async () => {
    const server = app.getHttpServer();
    const path = '/circles/' + circleId + '/search';
    await request(server).get(path).query({ q: 'Needle' }).expect(401);
    const response = await request(server)
      .get(path)
      .query({ q: 'needle' })
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(response.body.map((post: { id: number }) => post.id)).toEqual([
      postId,
    ]);
    expect(Object.keys(response.body[0].author).sort()).toEqual(['id', 'name']);
    await request(server)
      .get(path)
      .query({ q: 'needle' })
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    for (const q of ['%', '_', '\\']) {
      const literal = await request(server)
        .get(path)
        .query({ q })
        .auth(memberToken, { type: 'bearer' })
        .expect(200);
      expect(literal.body).toEqual([]);
    }
    for (const q of ['', '   ', 'x'.repeat(201)]) {
      await request(server)
        .get(path)
        .query({ q })
        .auth(memberToken, { type: 'bearer' })
        .expect(400);
    }
    await request(server)
      .get(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(400);
  });

  it('lists and revokes invites without leaking tokens or accepting a revoked link', async () => {
    const server = app.getHttpServer();
    const base = '/circles/' + circleId + '/invites';
    const created = await request(server)
      .post(base)
      .auth(ownerToken, { type: 'bearer' })
      .send({ maxUses: 2 })
      .expect(201);
    const id = created.body.id as number;
    const token = created.body.token as string;
    const listed = await request(server)
      .get(base)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    const invite = listed.body.find((item: { id: number }) => item.id === id);
    expect(Object.keys(invite).sort()).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'maxUses',
      'revokedAt',
      'uses',
    ]);
    await request(server)
      .get(base)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .get(base)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    const revoke = base + '/' + id + '/revoke';
    await request(server)
      .patch(revoke)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .patch('/circles/' + otherCircleId + '/invites/' + id + '/revoke')
      .auth(ownerToken, { type: 'bearer' })
      .expect(404);
    const first = await request(server)
      .patch(revoke)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(first.body.revokedAt).not.toBeNull();
    const repeated = await request(server)
      .patch(revoke)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(repeated.body.revokedAt).toBe(first.body.revokedAt);
    expect(repeated.body).not.toHaveProperty('tokenHash');
    await request(server)
      .post('/invites/' + token + '/accept')
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
  });

  it('supports poll management and enforces vote consistency in PostgreSQL', async () => {
    const server = app.getHttpServer();
    const base = '/circles/' + circleId + '/polls';
    await request(server).get(base).expect(401);
    const created = await request(server)
      .post(base)
      .auth(ownerToken, { type: 'bearer' })
      .send({
        title: 'Dinner?',
        options: ['Pizza', 'Sushi'],
        authorId: memberId,
      })
      .expect(201);
    const id = created.body.id as number;
    const firstOptionId = created.body.pollOptions[0].id as number;
    expect(created.body.authorId).toBe(ownerId);
    expect(created.body.pollOptions).toHaveLength(2);
    expect(created.body._count.votes).toBe(0);
    expect(Object.keys(created.body.author).sort()).toEqual(['id', 'name']);
    const path = base + '/' + id;
    const listed = await request(server)
      .get(base)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(listed.body.some((poll: { id: number }) => poll.id === id)).toBe(
      true,
    );
    await request(server)
      .get(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    await request(server)
      .get(path)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    await request(server)
      .get('/circles/' + otherCircleId + '/polls/' + id)
      .auth(ownerToken, { type: 'bearer' })
      .expect(404);
    await request(server)
      .patch(path)
      .auth(memberToken, { type: 'bearer' })
      .send({ title: 'Forbidden' })
      .expect(403);
    await request(server)
      .patch(path + '/close')
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .delete(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    const renamed = await request(server)
      .patch(path)
      .auth(ownerToken, { type: 'bearer' })
      .send({ title: 'Where to eat?' })
      .expect(200);
    expect(renamed.body.title).toBe('Where to eat?');
    const second = await request(server)
      .post(base)
      .auth(ownerToken, { type: 'bearer' })
      .send({ title: 'Another poll', options: ['A', 'B'] })
      .expect(201);
    const wrongOptionId = second.body.pollOptions[0].id as number;
    await expect(
      prisma.pollVote.create({
        data: { userId: memberId, pollId: id, optionId: wrongOptionId },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await request(server)
      .post(path + '/votes')
      .send({ optionId: firstOptionId })
      .expect(401);
    await request(server)
      .post(path + '/votes')
      .auth(outsiderToken, { type: 'bearer' })
      .send({ optionId: firstOptionId })
      .expect(404);
    await request(server)
      .post('/circles/' + otherCircleId + '/polls/' + id + '/votes')
      .auth(ownerToken, { type: 'bearer' })
      .send({ optionId: firstOptionId })
      .expect(404);
    await request(server)
      .post(path + '/votes')
      .auth(memberToken, { type: 'bearer' })
      .send({ optionId: wrongOptionId })
      .expect(404);
    await request(server)
      .post(path + '/votes')
      .auth(memberToken, { type: 'bearer' })
      .send({ optionId: 'bad' })
      .expect(400);
    const voteResponses = await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post(path + '/votes')
          .auth(memberToken, { type: 'bearer' })
          .send({ optionId: firstOptionId }),
      ),
    );
    expect(voteResponses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    await expect(
      prisma.pollVote.create({
        data: {
          userId: memberId,
          pollId: id,
          optionId: created.body.pollOptions[1].id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    const results = await request(server)
      .get(path)
      .auth(memberToken, { type: 'bearer' })
      .expect(200);
    expect(results.body._count.votes).toBe(1);
    expect(results.body.pollOptions[0]._count.votes).toBe(1);
    const closed = await request(server)
      .patch(path + '/close')
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(closed.body.closesAt).not.toBeNull();
    await request(server)
      .post(path + '/votes')
      .auth(ownerToken, { type: 'bearer' })
      .send({ optionId: firstOptionId })
      .expect(409);
    const closedAgain = await request(server)
      .patch(path + '/close')
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(closedAgain.body.closesAt).toBe(closed.body.closesAt);
    await request(server)
      .delete(path)
      .auth(ownerToken, { type: 'bearer' })
      .expect(204);
    expect(await prisma.pollVote.count({ where: { pollId: id } })).toBe(0);
  });

  it('validates poll options and optional closing dates', async () => {
    const base = '/circles/' + circleId + '/polls';
    for (const payload of [
      { title: '', options: ['A', 'B'] },
      { title: 'Poll', options: ['A'] },
      { title: 'Poll', options: ['A', '   '] },
      { title: 'Poll', options: ['A', 123] },
      { title: 'Poll', options: ['A', ' a '] },
      { title: 'Poll', options: ['A', 'B'], closesAt: 'invalid' },
      {
        title: 'Poll',
        options: ['A', 'B'],
        closesAt: '2000-01-01T00:00:00.000Z',
      },
    ]) {
      await request(app.getHttpServer())
        .post(base)
        .auth(ownerToken, { type: 'bearer' })
        .send(payload)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post(base)
      .auth(outsiderToken, { type: 'bearer' })
      .send({ title: 'Forbidden', options: ['A', 'B'] })
      .expect(404);
  });

  it('manages member roles, protects the owner and revokes access after leaving', async () => {
    const server = app.getHttpServer();
    const base = '/circles/' + circleId;
    const memberPath = base + '/members/' + memberId;
    await request(server)
      .patch(memberPath)
      .auth(memberToken, { type: 'bearer' })
      .send({ role: 'ADMIN' })
      .expect(403);
    await request(server)
      .patch(memberPath)
      .auth(ownerToken, { type: 'bearer' })
      .send({ role: 'OWNER' })
      .expect(400);
    await request(server)
      .patch(memberPath)
      .auth(ownerToken, { type: 'bearer' })
      .send({ role: 'ADMIN' })
      .expect(200);
    await request(server)
      .patch(base + '/members/' + ownerId)
      .auth(memberToken, { type: 'bearer' })
      .send({ role: 'MEMBER' })
      .expect(403);
    await request(server)
      .patch(base + '/members/' + ownerId)
      .auth(ownerToken, { type: 'bearer' })
      .send({ role: 'MEMBER' })
      .expect(409);
    await request(server)
      .delete(base + '/members/' + ownerId)
      .auth(ownerToken, { type: 'bearer' })
      .expect(409);
    await request(server)
      .delete(base + '/membership')
      .auth(ownerToken, { type: 'bearer' })
      .expect(409);
    const thirdId = userIds[2];
    await prisma.circleMembership.create({
      data: { userId: thirdId, circleId, role: 'ADMIN' },
    });
    await request(server)
      .delete(base + '/members/' + thirdId)
      .auth(memberToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .delete(base + '/members/' + thirdId)
      .auth(ownerToken, { type: 'bearer' })
      .expect(204);
    await prisma.circleMembership.create({
      data: { userId: thirdId, circleId, role: 'MEMBER' },
    });
    await request(server)
      .delete(base + '/members/' + thirdId)
      .auth(memberToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .get(base)
      .auth(outsiderToken, { type: 'bearer' })
      .expect(404);
    const ownPost = await prisma.post.create({
      data: { authorId: memberId, circleId, text: 'Preserve after leaving' },
    });
    await request(server)
      .delete(base + '/membership')
      .auth(memberToken, { type: 'bearer' })
      .expect(204);
    await request(server)
      .get(base + '/posts/' + ownPost.id)
      .auth(memberToken, { type: 'bearer' })
      .expect(404);
    const preserved = await request(server)
      .get(base + '/posts/' + ownPost.id)
      .auth(ownerToken, { type: 'bearer' })
      .expect(200);
    expect(preserved.body.text).toBe('Preserve after leaving');
  });
});
