const mongoose = require("mongoose");
const BonusModel = require("../../models/bonus");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const parseNullableDate = (v) => {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined; // invalid
  return d;
};

const parseNullableInt = (v) => {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
};

/**
 * POST /bonus
 * body: { manager, type, status?, amount, comment?, expire_on?, code?, max_uses? }
 */
const createBonus = async (req, res) => {
  try {
    const {
      manager,
      type,
      status = "active",
      amount,
      comment = "",
      expire_on = null,
      code = null,
      max_uses = null,
    } = req.body;

    if (!manager || !isValidObjectId(manager)) {
      return res.status(400).json({ success: false, errMsg: "Invalid manager id" });
    }

    if (!["claim", "coupon"].includes(type)) {
      return res.status(400).json({ success: false, errMsg: "Invalid type" });
    }

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, errMsg: "Invalid status" });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, errMsg: "Invalid amount" });
    }

    const expireDate = parseNullableDate(expire_on);
    if (expireDate === undefined) {
      return res.status(400).json({ success: false, errMsg: "Invalid expire_on date" });
    }

    const maxUses = parseNullableInt(max_uses);
    if (maxUses === undefined) {
      return res.status(400).json({ success: false, errMsg: "Invalid max_uses" });
    }

    // If it's coupon, code is usually required (optional rule)
    if (type === "coupon" && (!code || String(code).trim().length < 3)) {
      return res.status(400).json({ success: false, errMsg: "Coupon code is required (min 3 chars)" });
    }

    const doc = await BonusModel.create({
      manager,
      type,
      status,
      amount: Math.floor(amt * 100) / 100,
      comment,
      expire_on: expireDate,
      code: code ? String(code).trim() : null,
      max_uses: maxUses,
    });

    return res.status(201).json({ success: true, result: doc });
  } catch (error) {
    // Handle duplicate coupon code error
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, errMsg: "Bonus code already exists" });
    }
    console.error("createBonus error:", error);
    return res.status(500).json({ success: false, errMsg: error.message || "Server error" });
  }
};

/**
 * PATCH /bonus/:id
 * body: any updatable fields
 */
const updateBonus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, errMsg: "Invalid bonus id" });
    }

    const update = {};
    const {
      manager,
      type,
      status,
      amount,
      comment,
      expire_on,
      code,
      max_uses,
    } = req.body;

    if (manager !== undefined) {
      if (!isValidObjectId(manager)) return res.status(400).json({ success: false, errMsg: "Invalid manager id" });
      update.manager = manager;
    }

    if (type !== undefined) {
      if (!["claim", "coupon"].includes(type)) return res.status(400).json({ success: false, errMsg: "Invalid type" });
      update.type = type;
    }

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) return res.status(400).json({ success: false, errMsg: "Invalid status" });
      update.status = status;
    }

    if (amount !== undefined) {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ success: false, errMsg: "Invalid amount" });
      update.amount = Math.floor(amt * 100) / 100;
    }

    if (comment !== undefined) update.comment = String(comment || "");

    if (expire_on !== undefined) {
      const expireDate = parseNullableDate(expire_on);
      if (expireDate === undefined) return res.status(400).json({ success: false, errMsg: "Invalid expire_on date" });
      update.expire_on = expireDate;
    }

    if (code !== undefined) {
      const c = code === null ? null : String(code).trim();
      update.code = c && c.length ? c : null;
    }

    if (max_uses !== undefined) {
      const maxUses = parseNullableInt(max_uses);
      if (maxUses === undefined) return res.status(400).json({ success: false, errMsg: "Invalid max_uses" });
      update.max_uses = maxUses;
    }

    const doc = await BonusModel.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ success: false, errMsg: "Bonus not found" });

    return res.status(200).json({ success: true, result: doc });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, errMsg: "Bonus code already exists" });
    }
    console.error("updateBonus error:", error);
    return res.status(500).json({ success: false, errMsg: error.message || "Server error" });
  }
};

/**
 * DELETE /bonus/:id
 */
const deleteBonus = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, errMsg: "Invalid bonus id" });
    }

    const doc = await BonusModel.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, errMsg: "Bonus not found" });

    return res.status(200).json({ success: true, msg: "Bonus deleted", result: doc });
  } catch (error) {
    console.error("deleteBonus error:", error);
    return res.status(500).json({ success: false, errMsg: error.message || "Server error" });
  }
};

/**
 * GET /bonus/:id
 */
const getBonusById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, errMsg: "Invalid bonus id" });
    }

    const doc = await BonusModel.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, errMsg: "Bonus not found" });

    return res.status(200).json({ success: true, result: doc });
  } catch (error) {
    console.error("getBonusById error:", error);
    return res.status(500).json({ success: false, errMsg: error.message || "Server error" });
  }
};

/**
 * GET /bonus
 * query: manager?, type?, status?, search?, page?, limit?, activeNow?
 * - search matches code/comment
 * - activeNow=true returns active + not expired
 */
const listBonuses = async (req, res) => {
  try {
    const {
      manager,
      type,
      status,
      search = "",
      page = "1",
      limit = "20",
      activeNow = "false",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (manager) {
      if (!isValidObjectId(manager)) return res.status(400).json({ success: false, errMsg: "Invalid manager id" });
      filter.manager = manager;
    }
    if (type) {
      if (!["claim", "coupon"].includes(type)) return res.status(400).json({ success: false, errMsg: "Invalid type" });
      filter.type = type;
    }
    if (status) {
      if (!["active", "inactive"].includes(status)) return res.status(400).json({ success: false, errMsg: "Invalid status" });
      filter.status = status;
    }

    const s = String(search).trim();
    if (s) {
      filter.$or = [
        { comment: { $regex: s, $options: "i" } },
        { code: { $regex: s, $options: "i" } },
      ];
    }

    if (activeNow === "true") {
      const now = new Date();
      filter.status = "active";
      filter.$or = [
        ...(filter.$or || []),
      ];
      // not expired: expire_on is null OR expire_on >= now
      filter.$and = [
        ...(filter.$and || []),
        { $or: [{ expire_on: null }, { expire_on: { $gte: now } }] },
      ];
    }

    const total = await BonusModel.countDocuments(filter);
    const items = await BonusModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return res.status(200).json({
      success: true,
      items,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error("listBonuses error:", error);
    return res.status(500).json({ success: false, errMsg: error.message || "Server error" });
  }
};

module.exports = {
  createBonus,
  updateBonus,
  deleteBonus,
  getBonusById,
  listBonuses,
};
