import Notebook from '@/models/notebook.model'
import Page from '@/models/pages.model'
import Content from '@/models/content.model'

export class NotebookService {
  async createNotebook(userId: number, title: string) {
    return await Notebook.create({
      user_id: userId,
      title: title,
    })
  }

  async getNotebooks(userId: number) {
    return await Notebook.findAll({
      where: { user_id: userId, deleted: false },
      order: [['created_at', 'DESC']],
    })
  }

  async deleteNotebook(notebookId: number) {
    return await Notebook.update({ deleted: true }, { where: { id: notebookId } })
  }

  async createPage(notebookId: number, title: string) {
    return await Page.create({
      notebook_id: notebookId,
      title: title,
    })
  }
  async getPages(notebookId: number) {
    return await Page.findAll({
      where: { notebook_id: notebookId, deleted: false },
      order: [['created_at', 'DESC']],
    })
  }
  async deletePage(pageId: number) {
    return await Page.update({ deleted: true }, { where: { id: pageId } })
  }
  async createContent(
    pageId: number,
    type: string,
    data: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    return await Content.create({
      page_id: pageId,
      type: type,
      data: data,
      x: x,
      y: y,
      width: width,
      height: height,
    })
  }
  async getContent(pageId: number) {
    return await Content.findAll({
      where: { page_id: pageId, deleted: false },
      order: [['created_at', 'DESC']],
    })
  }
  async deleteContent(contentId: number) {
    return await Content.update({ deleted: true }, { where: { id: contentId } })
  }
  async updateContent(
    contentId: number,
    data: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    return await Content.update({ data, x, y, width, height }, { where: { id: contentId } })
  }
  async updatePage(pageId: number, title: string) {
    return await Page.update({ title }, { where: { id: pageId } })
  }
  async updateNotebook(notebookId: number, title: string) {
    return await Notebook.update({ title }, { where: { id: notebookId } })
  }
  async getNotebookById(notebookId: number) {
    return await Notebook.findOne({
      where: { id: notebookId, deleted: false },
    })
  }
  async getPageById(pageId: number) {
    return await Page.findOne({
      where: { id: pageId, deleted: false },
    })
  }
  async getContentById(contentId: number) {
    return await Content.findOne({
      where: { id: contentId, deleted: false },
    })
  }
  async getAllContentByNotebookId(notebookId: number) {
    return await Content.findAll({
      include: {
        model: Page,
        where: { notebook_id: notebookId, deleted: false },
      },
      where: { deleted: false },
      order: [['created_at', 'DESC']],
    })
  }
  async getAllPagesByNotebookId(notebookId: number) {
    return await Page.findAll({
      where: { notebook_id: notebookId, deleted: false },
      order: [['created_at', 'DESC']],
    })
  }
  async getAllNotebooksByUserId(userId: number) {
    return await Notebook.findAll({
      where: { user_id: userId, deleted: false },
      order: [['created_at', 'DESC']],
    })
  }
  async getAllContentByUserId(userId: number) {
    return await Content.findAll({
      include: {
        model: Page,
        include: {
          model: Notebook,
          where: { user_id: userId, deleted: false },
        },
      },
      where: { deleted: false },
      order: [['created_at', 'DESC']],
    })
  }
}
