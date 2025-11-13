import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaskComment, Task, User } from '@prisma/client';

@Injectable()
export class TaskCommentsSeederService {
  constructor(private prisma: PrismaService) {}

  async seed(tasks: Task[], users: User[]) {
    console.log('🌱 Seeding task comments...');

    if (!tasks || tasks.length === 0) {
      throw new Error('Tasks must be seeded before task comments');
    }

    if (!users || users.length === 0) {
      throw new Error('Users must be seeded before task comments');
    }

    const createdComments: TaskComment[] = [];

    // Add comments to selected tasks (not all tasks need comments)
    const tasksWithComments = tasks.filter((_, index) => index % 2 === 0).slice(0, 10); // Every 2nd task, max 10

    for (const task of tasksWithComments) {
      const commentsData = this.getCommentsDataForTask(task);

      for (const [index, commentData] of commentsData.entries()) {
        try {
          // Randomly select different users as comment authors
          const authorUser = users[index % users.length];

          const comment = await this.prisma.taskComment.create({
            data: {
              ...commentData,
              taskId: task.id,
              authorId: authorUser.id,
              createdBy: authorUser.id,
              updatedBy: authorUser.id,
            },
          });

          createdComments.push(comment);
          console.log(`   ✓ Created comment by ${authorUser.firstName} on task: ${task.title}`);

          // Add some replies to main comments (30% chance)
          if (Math.random() < 0.3 && commentsData.length > 1) {
            const replyData = this.getRandomReply();
            const replyAuthor = users[(index + 1) % users.length];

            try {
              const reply = await this.prisma.taskComment.create({
                data: {
                  ...replyData,
                  taskId: task.id,
                  authorId: replyAuthor.id,
                  parentCommentId: comment.id,
                  createdBy: replyAuthor.id,
                  updatedBy: replyAuthor.id,
                },
              });

              createdComments.push(reply);
              console.log(`   ✓ Created reply by ${replyAuthor.firstName} to comment`);
            } catch (error) {
              console.error(error);
              // Ignore reply creation errors
              console.error('Reply creation error:', error);
            }
          }
        } catch (_error) {
          console.error(_error);
          console.log(`   ⚠ Error creating comment on task ${task.title}: ${_error.message}`);
        }
      }
    }

    console.log(`✅ Task comments seeding completed. Created ${createdComments.length} comments.`);
    return createdComments;
  }

  private getCommentsDataForTask(task: Task) {
    // Different comment patterns based on task type
    if (task.type === 'BUG') {
      return [
        {
          content: `I can reproduce this issue consistently. It happens when the user tries to ${this.getRandomAction()}. The error occurs in the browser console.`,
        },
        {
          content:
            'Looking into this now. It seems to be related to the recent changes in the authentication flow.',
        },
        {
          content:
            'Fixed the issue by updating the validation logic. The problem was with how we handle edge cases in user input.',
        },
      ];
    } else if (task.type === 'STORY') {
      return [
        {
          content:
            'This feature will significantly improve user experience. I suggest we also consider mobile responsiveness from the start.',
        },
        {
          content:
            "Great idea! I've created some initial mockups. Should we schedule a design review meeting?",
        },
        {
          content:
            "The implementation is progressing well. I've completed about 70% of the functionality.",
        },
      ];
    } else if (task.type === 'EPIC') {
      return [
        {
          content:
            "This is a major feature that will span multiple sprints. Let's break it down into smaller, manageable tasks.",
        },
        {
          content:
            "I've outlined the technical approach in the attached document. We should discuss the architecture before proceeding.",
        },
      ];
    } else {
      // Default comments for regular tasks
      return [
        {
          content: this.getRandomStatusUpdate(),
        },
        {
          content: this.getRandomQuestionOrSuggestion(),
        },
      ];
    }
  }

  private getRandomAction(): string {
    const actions = [
      'submit the form',
      'navigate to the dashboard',
      'upload a file',
      'save their preferences',
      'search for items',
      'filter the results',
      'update their profile',
      'delete an item',
    ];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  private getRandomStatusUpdate(): string {
    const updates = [
      'Started working on this task. Initial research is complete.',
      'Made good progress today. About 60% complete.',
      'This is taking longer than expected due to some technical challenges.',
      'Almost done! Just need to add some tests and documentation.',
      'Task completed successfully. Ready for review.',
      'Encountered a blocker with the third-party API. Waiting for their response.',
      'Updated the implementation based on the feedback from the last review.',
      'Testing phase is complete. Everything looks good.',
    ];
    return updates[Math.floor(Math.random() * updates.length)];
  }

  private getRandomQuestionOrSuggestion(): string {
    const questions = [
      'Should we also consider adding error handling for edge cases?',
      'What about mobile compatibility? Do we need to test on different devices?',
      'I think we could optimize this further. Any thoughts on caching?',
      'The current approach works, but we might want to refactor for better maintainability.',
      'Do we need to update the documentation after this change?',
      'Should we add any analytics tracking to measure the impact?',
      "What's the expected timeline for the dependent tasks?",
      'Can we get design feedback before finalizing the UI changes?',
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  }

  private getRandomReply(): { content: string } {
    const replies = [
      { content: 'Thanks for the update! That sounds like a good approach.' },
      { content: "Agreed. Let's proceed with that plan." },
      { content: "Good point. I'll look into that as well." },
      { content: 'Let me know if you need any help with this.' },
      { content: 'Great work! The solution looks solid.' },
      { content: 'I can help with the testing part if needed.' },
      { content: "Makes sense. Let's schedule a quick discussion." },
      { content: 'Perfect! This should resolve the issue.' },
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  async clear() {
    console.log('🧹 Clearing task comments...');

    try {
      const deletedComments = await this.prisma.taskComment.deleteMany();
      console.log(`✅ Deleted ${deletedComments.count} task comments`);
    } catch (_error) {
      console.error('❌ Error clearing task comments:', _error);
      throw _error;
    }
  }

  findAll() {
    return this.prisma.taskComment.findMany({
      select: {
        id: true,
        content: true,
        task: {
          select: {
            id: true,
            title: true,
            taskNumber: true,
            project: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        author: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        parentComment: {
          select: {
            id: true,
            content: true,
          },
        },
        _count: {
          select: {
            replies: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to recent comments
    });
  }
}
