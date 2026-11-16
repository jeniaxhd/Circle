import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { CirclesService } from '../circles/circles.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { ListPostsDto } from './dto/list-posts.dto.js';
import { PostsService } from './posts.service.js';
import { StorageService } from '../storage/storage.service.js';
import { JobsService } from '../jobs/jobs.service.js';

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
const storages = { uploadImage: vi.fn(), deleteImage: vi.fn() };
const jobs = {deleteImage: vi.fn()}
let service: PostsService;

beforeEach(() => {
  vi.resetAllMocks();
  circles.findCircleById.mockResolvedValue({ id: 10 });
  prisma.post.findMany.mockResolvedValue([]);

  service = new PostsService(
    prisma as unknown as PrismaService,
    circles as unknown as CirclesService,
    storages as unknown as StorageService,
    jobs as unknown as JobsService,
  );
});

describe('Posts access control', () => {
  it.each(['create', 'findAll', 'findOne', 'update', 'remove'] as const)(
    'rejects %s when the requester is outside the circle',
    async (operation) => {
      circles.findCircleById.mockRejectedValue(new NotFoundException());
      const actions = {
        create: () => service.create(1, 10, { text: 'Hello' }),
        findAll: () => service.findAll(1, 10, new ListPostsDto()),
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
    await service.findAll(1, 10, new ListPostsDto());

    expect(prisma.post.findMany).toHaveBeenCalledWith({
      where: { circleId: 10, id: undefined },
      orderBy: { id: 'desc' },
      take: 21,
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

describe('Posts pagination', () => {
  it('returns only the requested page and a cursor for the last returned post', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 9 }, { id: 7 }, { id: 3 }]);
    const page = await service.findAll(1, 10, { limit: 2, cursor: 12 });
    expect(page).toEqual({ items: [{ id: 9 }, { id: 7 }], nextCursor: 7 });
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { circleId: 10, id: { lt: 12 } },
        take: 3,
      }),
    );
  });
  it('returns no next cursor when exactly one page remains', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 9 }, { id: 7 }]);
    expect(await service.findAll(1, 10, { limit: 2 })).toEqual({
      items: [{ id: 9 }, { id: 7 }],
      nextCursor: null,
    });
  });
  it('returns an empty page without a next cursor', async () => {
    expect(await service.findAll(1, 10, { limit: 2 })).toEqual({
      items: [],
      nextCursor: null,
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

describe('Post image replacement', () => {
  const file = {
    buffer: Buffer.from('test'),
    mimetype: 'image/png',
  } as Express.Multer.File;
  beforeEach(() => {
    prisma.post.findFirst.mockResolvedValue({
      id: 20,
      circleId: 10,
      authorId: 1,
      imageKey: 'old-key',
    });
    storages.uploadImage.mockResolvedValue('new-key');
  });

  it('returns the updated post and deletes the old image only after saving', async () => {
    const updated = { id: 20, imageKey: 'new-key' };
    prisma.post.update.mockImplementation(async () => {
      expect(storages.deleteImage).not.toHaveBeenCalled();
      return updated;
    });
    await expect(service.uploadImage(1, 20, 10, file)).resolves.toBe(updated);
    expect(storages.deleteImage).toHaveBeenCalledExactlyOnceWith('old-key');
  });

  it('does not delete any image on the first upload', async () => {
    prisma.post.findFirst.mockResolvedValue({
      id: 20,
      circleId: 10,
      authorId: 1,
      imageKey: null,
    });
    prisma.post.update.mockResolvedValue({ id: 20, imageKey: 'new-key' });
    await service.uploadImage(1, 20, 10, file);
    expect(storages.deleteImage).not.toHaveBeenCalled();
  });

  it('removes the new image and preserves the original database error', async () => {
    const error = new Error('Database unavailable');
    prisma.post.update.mockRejectedValue(error);
    await expect(service.uploadImage(1, 20, 10, file)).rejects.toBe(error);
    expect(storages.deleteImage).toHaveBeenCalledExactlyOnceWith('new-key');
  });

  it('preserves the database error even when cleanup also fails', async () => {
    const error = new Error('Database unavailable');
    prisma.post.update.mockRejectedValue(error);
    storages.deleteImage.mockRejectedValue(new Error('Storage unavailable'));
    const log = vi
      .spyOn(
        (
          service as unknown as {
            logger: { error: (...args: unknown[]) => void };
          }
        ).logger,
        'error',
      )
      .mockImplementation(() => {});
    try {
      await expect(service.uploadImage(1, 20, 10, file)).rejects.toBe(error);
      expect(log).toHaveBeenCalledOnce();
      expect(storages.deleteImage).toHaveBeenCalledExactlyOnceWith('new-key');
    } finally {
      log.mockRestore();
    }
  });

  it('does not delete the new image when deleting the old one fails', async () => {
    prisma.post.update.mockResolvedValue({ id: 20, imageKey: 'new-key' });
    const error = new Error('Old image deletion failed');
    storages.deleteImage.mockRejectedValue(error);
    await expect(service.uploadImage(1, 20, 10, file)).rejects.toBe(error);
    expect(storages.deleteImage).toHaveBeenCalledExactlyOnceWith('old-key');
  });

  it('leaves the database and old image untouched when upload fails', async () => {
    const error = new Error('Upload failed');
    storages.uploadImage.mockRejectedValue(error);
    await expect(service.uploadImage(1, 20, 10, file)).rejects.toBe(error);
    expect(prisma.post.update).not.toHaveBeenCalled();
    expect(storages.deleteImage).not.toHaveBeenCalled();
  });
});
