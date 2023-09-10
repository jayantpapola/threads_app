"use server";

import { revalidatePath } from "next/cache";
import Thread from "../models/thread.model";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";

interface Params {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

export async function createThread({
  text,
  author,
  communityId,
  path,
}: Params) {
  try {
    connectToDB();

    const createThread = await Thread.create({
      text,
      author,
      community: null,
    });

    await User.findByIdAndUpdate(author, {
      $push: { threads: createThread._id },
    });

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed To Create Thread ${error.message}`);
  }
}

export async function fetchPost(pageNum = 1, pageSize = 20) {
  try {
    connectToDB();

    const skipamount = (pageNum - 1) * pageSize;
    const posts = await Thread.find({
      parentId: { $in: [null, undefined] },
    })
      .sort({ createdAt: "desc" })
      .skip(skipamount)
      .limit(pageSize)
      // .populate("author children author.children")
      .populate({ path: "author", model: "User" });
    // .populate({
    //   path: "children",
    //   populate: {
    //     path: "author",
    //     model: "User",
    //     select: "_id name parentId image",
    //   },
    // });
    const totalPostCount = await Thread.countDocuments({
      parentId: { $in: [null, undefined] },
    });

    const isNext = totalPostCount > skipamount + posts.length;

    return { posts, isNext };
  } catch (error: any) {
    throw new Error(`Failed to fetch threads ${error.message}`);
  }
}

export async function fetchThreadById(id: string) {
  try {
    connectToDB();
    const thread = await Thread.findById(id)
      // .populate("author children")
      .populate({ path: "author", model: User, select: "_id id name image" })
      .populate({
        path: "children",
        model: Thread,
        populate: [
          { path: "author", model: User, select: "_id id name parentId image" },
          {
            path: "children",
            model: Thread,
            populate: {
              path: "author",
              model: User,
              select: "_id id name image parentId",
            },
          },
        ],
      })
      .exec();
    return thread;
  } catch (error: any) {
    throw new Error(`Failed to fetch threads ${error.message}`);
  }
}
export async function addCommentToThread(
  threadId: string,
  commentText: string,
  userId: string,
  path: string
) {
  connectToDB();
  try {
    const originalThread = await Thread.findById(threadId);
    if (!originalThread) {
      throw new Error("Thread not Found");
    }

    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId,
    });

    const savedCommentThread = await commentThread.save();

    originalThread.children.push(savedCommentThread._id);
    await originalThread.save();
    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to fetch threads ${error.message}`);
  }
}
