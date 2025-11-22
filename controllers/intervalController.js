// const managerModel = require('../models/manager');
// const investmentModel = require('../models/investment');
// const investmentTransactionModel = require('../models/investmentTx');
// const userModel = require('../models/user')
// const rebateTransactionModel = require('../models/rebateTx');
// const { default: mongoose } = require('mongoose');
// const intervalModel = require('../models/interval');


// const intervalHandle = async () => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     console.log("Fetching weekly managers...");
//     const managers = await managerModel
//       .find({ trading_interval: "weekly" })
//       .session(session);

//     const managerIds = managers.map((m) => m._id);
//     console.log(`Managers found: ${managers.length}`);

//     const investments = await investmentModel
//       .find({ manager: { $in: managerIds } })
//       .session(session);

//     console.log(`Investments found: ${investments.length}`);

//     const processed = new Set();

//     const investmentUpdates = [];
//     const managerUpdates = [];
//     const inviterUpdates = [];
//     const feeTransactions = [];
//     const rebateTransactions = [];

//     for (const inv of investments) {
//       if (processed.has(inv._id.toString())) continue;
//       processed.add(inv._id.toString());

//       const profit = toTwoDecimals(inv.current_interval_profit_equity);
//       const perfFee = toTwoDecimals(inv.performance_fee_projected);

//       if (profit === 0 && perfFee === 0) {
//         console.log(`Skipping investment ${inv._id} (no profit or fee).`);
//         continue;
//       }

//       // ---------------------------------------
//       // NET PROFIT (after removing performance fee)
//       // ---------------------------------------
//       const netProfit = toTwoDecimals(profit - perfFee);

//       // ---------------------------------------
//       // HANDLE INVITER REBATE (if referred_by exists)
//       // ---------------------------------------
//       let inviterShare = 0;
//       let adjustedPerfFee = perfFee;

//       if (inv.referred_by) {
//         const inviter = await userModel
//           .findById(inv.referred_by)
//           .session(session);

//         if (inviter) {
//           inviterShare = toTwoDecimals(perfFee / 3); // 33% rebate
//           adjustedPerfFee = toTwoDecimals(perfFee - inviterShare);

//           inviterUpdates.push({
//             updateOne: {
//               filter: { _id: inviter._id },
//               update: {
//                 $inc: {
//                   "wallets.rebate": inviterShare,
//                   "referral.total_earned_commission": inviterShare,
//                   "referral.investments.$[elem].rebate_recieved": inviterShare,
//                 },
//               },
//               arrayFilters: [{ "elem.investment_id": inv._id }],
//             },
//           });

//           rebateTransactions.push({
//             user: inviter._id,
//             investment: inv._id,
//             type: "commission",
//             status: "approved",
//             amount: inviterShare,
//             description: `Weekly rebate distributed`,
//           });
//         }
//       }

//       // ---------------------------------------
//       // UPDATE INVESTMENT
//       // ---------------------------------------
//       investmentUpdates.push({
//         updateOne: {
//           filter: { _id: inv._id },
//           update: {
//             $inc: {
//               total_equity: netProfit,
//               net_profit: netProfit,
//               performance_fee_paid: perfFee,
//             },
//             $set: {
//               performance_fee_projected: 0,
//               current_interval_profit_equity: 0,
//               current_interval_profit: 0,
//             },
//           },
//         },
//       });

//       // ---------------------------------------
//       // UPDATE MANAGER (collect adjusted performance fee)
//       // ---------------------------------------
//       managerUpdates.push({
//         updateOne: {
//           filter: { _id: inv.manager },
//           update: {
//             $inc: { total_performance_fee_collected: adjustedPerfFee },
//           },
//         },
//       });

//       // ---------------------------------------
//       // CREATE MANAGER FEE TRANSACTION
//       // ---------------------------------------
//       feeTransactions.push({
//         user: inv.user,
//         investment: inv._id,
//         type: "manager_fee",
//         status: "success",
//         amount: perfFee,
//         comment: `Performance fee deducted (${perfFee})`,
//       });

//       console.log(
//         `Processed investment ${inv._id} | Net Profit: ${netProfit} | Perf Fee: ${perfFee}`
//       );
//     }

//     // ---------------------------------------
//     // EXECUTE ALL BULK OPERATIONS IN PARALLEL
//     // ---------------------------------------
//     const bulkOps = [];

//     if (investmentUpdates.length)
//       bulkOps.push(investmentModel.bulkWrite(investmentUpdates, { session }));

//     if (managerUpdates.length)
//       bulkOps.push(managerModel.bulkWrite(managerUpdates, { session }));

//     if (inviterUpdates.length)
//       bulkOps.push(userModel.bulkWrite(inviterUpdates, { session }));

//     if (feeTransactions.length)
//       bulkOps.push(
//         investmentTransactionModel.insertMany(feeTransactions, { session })
//       );

//     if (rebateTransactions.length)
//       bulkOps.push(
//         rebateTransactionModel.insertMany(rebateTransactions, { session })
//       );

//     await Promise.all(bulkOps);

//     await session.commitTransaction();
//     session.endSession();

//     console.log("✔ Weekly interval settlement completed.");
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     console.error("❌ Interval handling failed:", error);
//   }
// };

// const handleInterval = async () => {
//   // Complete last pending interval
//   const existing = await intervalModel
//     .findOne({ status: "pending" })
//     .sort({ createdAt: -1 });

//   if (existing) {
//     existing.status = "completed";
//     await existing.save();
//   }

//   // Week start (Sunday) & end (Saturday)
//   const today = new Date();
//   const dow = today.getUTCDay();

//   const start = new Date(today);
//   start.setUTCDate(today.getUTCDate() - dow);
//   start.setUTCHours(0, 0, 0, 0);

//   const end = new Date(start);
//   end.setUTCDate(start.getUTCDate() + 6);
//   end.setUTCHours(23, 59, 59, 999);

//   const label = `${start.toLocaleDateString("en-US", {
//     month: "short",
//     day: "numeric",
//   })}–${end.toLocaleDateString("en-US", {
//     day: "numeric",
//   })} ${start.getUTCFullYear()}`;

//   const interval = new intervalModel({
//     period: "weekly",
//     status: "pending",
//     current_interval_start: start,
//     current_interval_end: end,
//     current_intervel: label,
//   });

//   await interval.save();
//   await intervalHandle();
// };



// //---------------Test api Function---------
// const intervalInvestmentHandle=async(req,res)=>{
//     try {
//         await handleInterval()
//         res.status(200).json({ msg: 'Interval investment handling completed successfully' });
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ errMsg: 'Server side error', error: error.message });
//     }
// }

// module.exports = {
//     intervalInvestmentHandle,
//     handleInterval
// };


const managerModel = require('../models/manager');
const investmentModel = require('../models/investment');
const investmentTransactionModel = require('../models/investmentTx');
const userModel = require('../models/user');
const rebateTransactionModel = require('../models/rebateTx');
const intervalModel = require('../models/interval');
const { default: mongoose } = require('mongoose');
const { toTwoDecimals } = require('../utils/decimal');


/* ============================================================================
   WEEKLY SETTLEMENT LOGIC
============================================================================ */
const intervalHandle = async () => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("Fetching weekly managers...");
    const managers = await managerModel
      .find({ trading_interval: "weekly" })
      .session(session);

    const managerIds = managers.map((m) => m._id);

    const investments = await investmentModel
      .find({ manager: { $in: managerIds } })
      .session(session);

    const processed = new Set();

    const investmentUpdates = [];
    const managerUpdates = [];
    const inviterUpdates = [];
    const feeTransactions = [];
    const rebateTransactions = [];

    let processedCount = 0;

    for (const inv of investments) {
      if (processed.has(inv._id.toString())) continue;
      processed.add(inv._id.toString());

      const profit = toTwoDecimals(inv.current_interval_profit_equity);
      const perfFee = toTwoDecimals(inv.performance_fee_projected);

      if (profit === 0 && perfFee === 0) continue;

      processedCount++;

      const netProfit = toTwoDecimals(profit - perfFee);

      // --------------------- INVITER REBATE ---------------------
      let inviterShare = 0;
      let adjustedPerfFee = perfFee;

      if (inv.referred_by) {
        const inviter = await userModel
          .findById(inv.referred_by)
          .session(session);

        if (inviter) {
          inviterShare = toTwoDecimals(perfFee / 3);
          adjustedPerfFee = toTwoDecimals(perfFee - inviterShare);

          inviterUpdates.push({
            updateOne: {
              filter: { _id: inviter._id },
              update: {
                $inc: {
                  "wallets.rebate": inviterShare,
                  "referral.total_earned_commission": inviterShare,
                  "referral.investments.$[elem].rebate_recieved": inviterShare,
                },
              },
              arrayFilters: [{ "elem.investment_id": inv._id }],
            },
          });

          rebateTransactions.push({
            user: inviter._id,
            investment: inv._id,
            type: "commission",
            status: "approved",
            amount: inviterShare,
            description: `Weekly rebate distributed`,
          });
        }
      }

      // --------------------- UPDATE INVESTMENT ---------------------
      investmentUpdates.push({
        updateOne: {
          filter: { _id: inv._id },
          update: {
            $inc: {
              total_equity: netProfit,
              net_profit: netProfit,
              performance_fee_paid: perfFee,
            },
            $set: {
              performance_fee_projected: 0,
              current_interval_profit_equity: 0,
              current_interval_profit: 0,
            },
          },
        },
      });

      // --------------------- UPDATE MANAGER ---------------------
      managerUpdates.push({
        updateOne: {
          filter: { _id: inv.manager },
          update: {
            $inc: { total_performance_fee_collected: adjustedPerfFee },
          },
        },
      });

      // --------------------- FEE TRANSACTION ---------------------
      feeTransactions.push({
        user: inv.user,
        investment: inv._id,
        type: "manager_fee",
        status: "success",
        amount: perfFee,
        comment: `Performance fee deducted (${perfFee})`,
      });
    }

    // --------------------- BULK EXECUTION ---------------------
    const jobs = [];

    if (investmentUpdates.length)
      jobs.push(investmentModel.bulkWrite(investmentUpdates, { session }));

    if (managerUpdates.length)
      jobs.push(managerModel.bulkWrite(managerUpdates, { session }));

    if (inviterUpdates.length)
      jobs.push(userModel.bulkWrite(inviterUpdates, { session }));

    if (feeTransactions.length)
      jobs.push(investmentTransactionModel.insertMany(feeTransactions, { session }));

    if (rebateTransactions.length)
      jobs.push(rebateTransactionModel.insertMany(rebateTransactions, { session }));

    await Promise.all(jobs);

    // UPDATE last interval record with processed count
    await intervalModel.findOneAndUpdate(
      { status: "pending" },
      { total_investments_processed: processedCount }
    );

    await session.commitTransaction();
    session.endSession();

    console.log("✔ Weekly interval settlement completed.");

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Interval handling failed:", error);
  }
};


/* ============================================================================
   CREATE NEW WEEKLY INTERVAL
============================================================================ */
const handleInterval = async () => {
  // Close last pending interval
  const existing = await intervalModel
    .findOne({ status: "pending" })
    .sort({ createdAt: -1 });

  if (existing) {
    existing.status = "completed";
    await existing.save();
  }

  // Compute weekly dates
  const today = new Date();
  const dow = today.getUTCDay(); // Sunday = 0

  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - dow);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  // Compute weekly label
  const label = `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}–${end.toLocaleDateString("en-US", {
    day: "numeric",
  })} ${start.getUTCFullYear()}`;

  // Compute interval_index
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const weekNumber =
    Math.ceil(((today - yearStart) / 86400000 + yearStart.getUTCDay() + 1) / 7);

  const intervalIndex = `${today.getUTCFullYear()}-W${weekNumber
    .toString()
    .padStart(2, "0")}`;

  // Save new interval
  await intervalModel.create({
    period: "weekly",
    status: "pending",
    current_interval_start: start,
    current_interval_end: end,
    current_intervel: label,
    interval_index: intervalIndex,
    total_investments_processed: 0,
  });

  // Run settlement
  await intervalHandle();
};


/* ============================================================================
   API for testing
============================================================================ */
const intervalInvestmentHandle = async (req, res) => {
  try {
    await handleInterval();
    res.status(200).json({ msg: "Interval investment handling completed successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errMsg: "Server error", error: error.message });
  }
};

module.exports = {
  intervalInvestmentHandle,
  handleInterval,
};
