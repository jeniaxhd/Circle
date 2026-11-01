import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { PostsService } from './posts.service.js';

const prisma = {
  post: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};
const circles = { findCircleById: vi.fn() };
let service: PostsService;

beforeEach(() => {
  vi.resetAllMocks();
  circles.findCircleById.mockResolvedValue({ id: 10 });
  service = new PostsService(
    prisma as unknown as PrismaService,
    circles as unknown as CirclesService,
  );
});

describe('Posts access control', () => {
  it.each(['create', 'findAll', 'findOne', 'update', 'remove'] as const)(
    'rejects %s when the requester is outside the circle',
    async (operation) => {
      circles.findCircleById.mockRejectedValue(new NotFoundException());
      const actions = {
        create: () => service.create(1, 10, { text: 'Hello' }),
        findAll: () => service.findAll(1, 10),
        findOne: () => service.findOne(1, 10, 20),
        update: () => service.update(1, 10, 20, { text: 'Edited' }),
        remove: () => service.remove(1, 10, 20),
      };

      await expect(actions[operation]()).rejects.toBeInstanceOf(
        NotFoundException,
      );
      for (const query of Object.values(prisma.post)) {
        expect(query).not.toHaveBeenCalled();
      }
    },
  );

  it('looks up a post by both post ID and circle ID', async () => {
    prisma.post.findFirst.mockResolvedValue(null);

    await expect(service.findOne(1, 10, 20)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 20, circleId: 10 } }),
    );
  });

  it.each(['update', 'remove'] as const)(
    'rejects %s for another author even when the requester can access the circle',
    async (operation) => {
      prisma.post.findFirst.mockResolvedValue({
        id: 20,
        circleId: 10,
        authorId: 2,
      });
      const action =
        operation === 'update'
          ? service.update(1, 10, 20, { text: 'Edited' })
          : service.remove(1, 10, 20);

      await expect(action).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.post.update).not.toHaveBeenCalled();
      expect(prisma.post.delete).not.toHaveBeenCalled();
    },
  );

  it('takes the author and circle from trusted arguments, not body fields', async () => {
    const dto = { text: 'Hello', authorId: 999, circleId: 999 };
    await service.create(1, 10, dto);

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { authorId: 1, circleId: 10, text: 'Hello' },
        include: { author: { select: { id: true, name: true } } },
      }),
    );
  });

  it('scopes the feed to its circle and limits the returned author fields', async () => {
    await service.findAll(1, 10);

    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { circleId: 10 },
      orderBy: { id: 'desc' },
      take: 50,
      include: { author: { select: { id: true, name: true } } },
    });
  });

  it("updates the author's own post and returns the result", async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: 20,
      circleId: 10,
      authorId: 1,
    });
    const edited = { id: 20, text: 'Edited' };
    prisma.post.update.mockResolvedValue(edited);

    await expect(
      service.update(1, 10, 20, { text: 'Edited' }),
    ).resolves.toEqual(edited);
    expect(prisma.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 20, circleId: 10, authorId: 1 },
        data: { text: 'Edited' },
      }),
    );
  });

  it("deletes the author's own post without returning a body", async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: 20,
      circleId: 10,
      authorId: 1,
    });

    await expect(service.remove(1, 10, 20)).resolves.toBeUndefined();
    expect(prisma.post.delete).toHaveBeenCalledWith({
      where: { id: 20, circleId: 10, authorId: 1 },
    });
  });
});

describe.each([CreatePostDto, UpdatePostDto])('%s validation', (Dto) => {
  it.each([undefined, null, '', '   ', 123, 'x'.repeat(5001)])(
    'rejects missing, empty, non-string, or oversized text (case %#)',
    async (text) => {
      const dto = Object.assign(new Dto(), { text });
      expect(await validate(dto)).not.toHaveLength(0);
    },
  );

  it('accepts non-empty text within the limit', async () => {
    const dto = Object.assign(new Dto(), { text: 'Hello, circle!' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
