const managerModel = require('../models/manager');
const investmentModel = require('../models/investment');
const investmentTransactionModel = require('../models/investmentTx');
const userModel = require('../models/user')
const rebateTransactionModel = require('../models/rebateTx');
const { default: mongoose } = require('mongoose');
const intervalModel = require('../models/interval');

// const intervalInvestmentHandle = async (req, res) => {
//     try {
//         // Fetch all managers
//         const managers = await managerModel.find({trading_interval:'weekly'});

//         // Process each manager
//         for (const manager of managers) {
//             // Fetch all investments for the manager
//             const investments = await investmentModel.find({ manager: manager._id });

//             for (const investment of investments) {
//                 // Calculate the amount to be added to total funds
//                 const netIntervalProfit = investment.current_interval_profit_equity - investment.performance_fee_projected;

//                 // Update investment's total funds and net profit
//                 investment.total_funds += netIntervalProfit;
//                 investment.net_profit += netIntervalProfit;

//                 // Update manager's performance fee and investment's fee tracking
//                 let adjustedPerformanceFee =investment.performance_fee_projected

//                 if (investment.inviter) {
//                     const inviter = await userModel.findOne({ user_id: investment.inviter });
//                     if (inviter && investment.performance_fee_projected > 0) {
//                         // Calculate inviter's share (5% of total profit)
//                         const inviterShare = investment.current_interval_profit_equity * 0.05;
                
//                         // Update inviter's wallets and commission tracking
//                         inviter.my_wallets.rebate_wallet += inviterShare;
//                         inviter.referral.total_earned_commission += inviterShare;
//                         await inviter.save();

//                         const rebateTransaction = new rebateTransactionModel({
//                             user : inviter._id,
//                             investment : investment._id,
//                             type : 'commission',
//                             status : 'approved',
//                             amount : inviterShare , 
//                             description : `Weekly commission distribution.`,
//                         })
//                         await rebateTransaction.save()
                        
//                         // Adjust the performance fee by deducting the inviter's share
//                         adjustedPerformanceFee = Math.max(0, investment.performance_fee_projected - inviterShare);
//                     }
//                 }
                
//                 manager.total_performance_fee_collected += adjustedPerformanceFee;
//                 investment.performance_fee_paid += investment.performance_fee_projected;

//                 // Reset performance fee projections and profits
//                 investment.performance_fee_projected = 0;
//                 investment.current_interval_profit_equity = 0;
//                 investment.current_interval_profit = 0;

//                 // Create a performance fee deduction transaction
//                 const feeTransaction = new investmentTransactionModel({
//                     user: investment.user,
//                     investment: investment._id,
//                     type: 'manager_fee',
//                     status: 'success',
//                     amount: investment.performance_fee_paid, // Use correct value
//                     comment: `Performance fee of ${investment.performance_fee_paid} deducted`,
//                 });

//                 // Save investment and fee transaction
//                 await investment.save();
//                 await feeTransaction.save();

//                 console.log(`Handled current interval profit of ${netIntervalProfit} for investment ${investment._id}`);
//             }

//             // Save the manager with updated performance fee
//             await manager.save();
//         }

//         res.status(200).json({ message: 'Interval investment handling completed successfully' });
//     } catch (error) {
//         console.error('Error in interval investment handling:', error);
//         res.status(500).json({ errMsg: 'Server side error', error: error.message });
//     }
// };
  

// const intervalInvestmentHandle = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//         // Fetch all managers with trading interval "weekly"
//         const managers = await managerModel.find({ trading_interval: 'weekly' }).session(session);

//         // Fetch all investments in bulk
//         const managerIds = managers.map(m => m._id);
//         const investments = await investmentModel.find({ manager: { $in: managerIds } }).session(session);

//         // Prepare bulk update operations
//         const investmentUpdates = [];
//         const managerUpdates = [];
//         const feeTransactions = [];
//         const rebateTransactions = [];
//         const inviterUpdates = [];

//         // Process investments
//         for (const investment of investments) {
//             const netIntervalProfit = investment.current_interval_profit_equity - investment.performance_fee_projected;
//             let adjustedPerformanceFee = investment.performance_fee_projected;
//             let inviterShare = 0;

//             // If inviter exists, calculate and store updates
//             if (investment.referred_by) {
//                 const inviter = await userModel.findOne({ user_id: investment.referred_by }).session(session);
//                 if (inviter && investment.performance_fee_projected > 0) {
//                     inviterShare = investment.current_interval_profit_equity * 0.05;
//                     adjustedPerformanceFee -= inviterShare;

//                     // Store inviter updates
//                     inviterUpdates.push({
//                         updateOne: {
//                             filter: { _id: inviter._id },
//                             update: {
//                                 $inc: {
//                                     "my_wallets.rebate_wallet": inviterShare,
//                                     "referral.total_earned_commission": inviterShare
//                                 }
//                             }
//                         }
//                     });

//                     // Store rebate transaction
//                     rebateTransactions.push({
//                         user: inviter._id,
//                         investment: investment._id,
//                         type: 'commission',
//                         status: 'approved',
//                         amount: inviterShare,
//                         description: `Weekly commission distribution.`,
//                     });
//                 }
//             }

//             // Ensure performance fee is properly tracked
//             const performanceFeePaid = investment.performance_fee_projected;

//             // Prepare investment updates
//             investmentUpdates.push({
//                 updateOne: {
//                     filter: { _id: investment._id },
//                     update: {
//                         $inc: {
//                             total_funds: netIntervalProfit,
//                             net_profit: netIntervalProfit,
//                             performance_fee_paid: performanceFeePaid, // Ensure correct tracking
//                         },
//                         $set: {
//                             performance_fee_projected: 0,
//                             current_interval_profit_equity: 0,
//                             current_interval_profit: 0
//                         }
//                     }
//                 }
//             });

//             // Prepare manager updates
//             managerUpdates.push({
//                 updateOne: {
//                     filter: { _id: investment.manager },
//                     update: { $inc: { total_performance_fee_collected: adjustedPerformanceFee } }
//                 }
//             });

//             // Prepare performance fee transaction **before resetting performance_fee_projected**
//             feeTransactions.push({
//                 user: investment.user,
//                 investment: investment._id,
//                 type: 'manager_fee',
//                 status: 'success',
//                 amount: performanceFeePaid, // Ensure this reflects the actual deducted amount
//                 comment: `Performance fee of ${performanceFeePaid} deducted`,
//             });
//         }

//         // Execute bulk operations
//         if (investmentUpdates.length) await investmentModel.bulkWrite(investmentUpdates, { session });
//         if (managerUpdates.length) await managerModel.bulkWrite(managerUpdates, { session });
//         if (inviterUpdates.length) await userModel.bulkWrite(inviterUpdates, { session });
//         if (rebateTransactions.length) await rebateTransactionModel.insertMany(rebateTransactions, { session });
//         if (feeTransactions.length) await investmentTransactionModel.insertMany(feeTransactions, { session });

//         // Commit transaction
//         await session.commitTransaction();
//         session.endSession();

//         res.status(200).json({ message: 'Interval investment handling completed successfully' });
//     } catch (error) {
//         await session.abortTransaction();
//         session.endSession();
//         console.error('Error in interval investment handling:', error);
//         res.status(500).json({ errMsg: 'Server side error', error: error.message });
//     }
// };

const truncateToTwoDecimals = (num) => {
    return Math.floor(num * 100) / 100;
  };
  

const intervalHandle = async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log("Fetching managers with weekly trading interval...");
        const managers = await managerModel.find({ trading_interval: 'weekly' }).session(session);

        const managerIds = managers.map(m => m._id);
        console.log(`Found ${managers.length} managers.`);

        console.log("Fetching investments...");
        const investments = await investmentModel.find({ manager: { $in: managerIds } }).session(session);
        console.log(`Found ${investments.length} investments.`);

        const investmentUpdates = [];
        const managerUpdates = [];
        const feeTransactions = [];
        const rebateTransactions = [];
        const inviterUpdates = [];

        const processedInvestments = new Set(); // Track processed investment IDs

        for (const investment of investments) {

        // ✅ Skip iteration if there's no profit or performance fee
        if (investment.current_interval_profit_equity === 0 && investment.performance_fee_projected === 0) {
            console.log(`Skipping investment ${investment._id} - No profit or fee to process.`);
            continue;
        }

        // ✅ Prevent duplicate processing
        if (processedInvestments.has(investment._id.toString())) {
            console.warn(`Skipping duplicate processing for investment: ${investment._id}`);
            continue;
        }

        processedInvestments.add(investment._id.toString());                                    

        const netIntervalProfit = truncateToTwoDecimals(investment.current_interval_profit_equity - investment.performance_fee_projected);
        let adjustedPerformanceFee = truncateToTwoDecimals(investment.performance_fee_projected);
        let inviterShare = 0;

        if (investment.referred_by) {
                const inviter = await userModel.findOne({ _id: investment.referred_by }).session(session);
                if (inviter && investment.performance_fee_projected > 0) {
                    inviterShare = truncateToTwoDecimals(investment.performance_fee_projected / 3);
                    adjustedPerformanceFee = truncateToTwoDecimals(adjustedPerformanceFee - inviterShare);
            
                    inviterUpdates.push({
                        updateOne: {
                            filter: { _id: inviter._id },
                            update: {
                                $inc: {
                                    "my_wallets.rebate_wallet": inviterShare,
                                    "referral.total_earned_commission": inviterShare,
                                    "referral.investments.$[elem].rebate_recieved": inviterShare
                                }
                            },
                            arrayFilters: [{ "elem.investment_id": investment._id }]
                        }
                    });
            
                    rebateTransactions.push({
                        user: inviter._id,
                        investment: investment._id,
                        type: 'commission',
                        status: 'approved',
                        amount: inviterShare,
                        description: `Weekly commission distribution.#MANAGER:${adjustedPerformanceFee} #REBATE:${inviterShare}`,
                    });
            
                    console.log(`Inviter ${inviter._id} updated with rebate: ${inviterShare}`);
                }
            }
            
            const performanceFeePaid = truncateToTwoDecimals(investment.performance_fee_projected);

            investmentUpdates.push({
                updateOne: {
                    filter: { _id: investment._id },
                    update: {
                        $inc: {
                            total_funds: netIntervalProfit,
                            net_profit: netIntervalProfit,
                            performance_fee_paid: performanceFeePaid,
                        },
                        $set: {
                            performance_fee_projected: 0,
                            current_interval_profit_equity: 0,
                            current_interval_profit: 0
                        }
                    }
                }
            });

            managerUpdates.push({
                updateOne: {
                    filter: { _id: investment.manager },
                    update: { $inc: { total_performance_fee_collected: adjustedPerformanceFee } }
                }
            });
            
            feeTransactions.push({
                user: investment.user,
                investment: investment._id,
                type: 'manager_fee',
                status: 'success',
                amount: performanceFeePaid,
                comment: `Performance fee is deducted.`,
            });

            console.log(`Investment ${investment._id} updated: net profit = ${netIntervalProfit}, performance fee = ${performanceFeePaid}`);
        }

        console.log("Executing bulk operations...");

        const bulkOperations = [];

        if (investmentUpdates.length) {
            bulkOperations.push(investmentModel.bulkWrite(investmentUpdates, { session }).then(res => console.log(`Investment updates applied: ${res.modifiedCount}`)));
        }

        if (managerUpdates.length) {
            bulkOperations.push(managerModel.bulkWrite(managerUpdates, { session }).then(res => console.log(`Manager updates applied: ${res.modifiedCount}`)));
        }

        if (inviterUpdates.length) {
            bulkOperations.push(userModel.bulkWrite(inviterUpdates, { session }).then(res => console.log(`Inviter updates applied: ${res.modifiedCount}`)));
        }

        if (rebateTransactions.length) {
            bulkOperations.push(rebateTransactionModel.insertMany(rebateTransactions, { session }).then(res => console.log(`Rebate transactions inserted: ${res.length}`)));
        }

        if (feeTransactions.length) {
            bulkOperations.push(investmentTransactionModel.insertMany(feeTransactions, { session }).then(res => console.log(`Fee transactions inserted: ${res.length}`)));
        }

        await Promise.all(bulkOperations);

        await session.commitTransaction();
        session.endSession();
        console.log("Interval investment handling completed successfully.");
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('Error in interval investment handling:', error);
    }
};

const getCurrentWeekEndDate = () => {
    const today = new Date();
    const dayOfWeek = today.getUTCDay(); // Use UTC-based day of the week

    // Get last Sunday (or today if it's Sunday)
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setUTCDate(today.getUTCDate() - dayOfWeek);
    firstDayOfWeek.setUTCHours(0, 0, 0, 0); // Ensure UTC time

    // Get next Saturday at 23:59:59 UTC
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setUTCDate(firstDayOfWeek.getUTCDate() + 6);
    lastDayOfWeek.setUTCHours(23, 59, 59, 999); // Ensure UTC time

    return { firstDayOfWeek, lastDayOfWeek };
};


const getCurrentWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();

    // Calculate the date of the last Sunday (or today if it's Sunday)
    const firstDayOfWeek = new Date(today);
    firstDayOfWeek.setDate(today.getDate() - dayOfWeek); // Sunday

    // Calculate the date of the next Saturday
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6); // Saturday

    // Format the start and end dates
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const startDate = firstDayOfWeek.toLocaleDateString('en-US', options);
    const endDate = lastDayOfWeek.toLocaleDateString('en-US', options);
    
    // Split the formatted strings
    const startParts = startDate.split(' ');
    const endParts = endDate.split(' ');

    // Extracting month, day, and year to construct the final string
    const startMonth = startParts[0];
    const startDay = startParts[1];
    const endDay = endParts[1];
    const year = startParts[2];

    // Construct the final string without extra commas
    return `${startMonth} ${startDay}–${endDay} ${year}`.replace(/,\s*–/g, '–'); // Remove any comma before the dash
};

const handleInterval = async () => {
    const interval = await intervalModel.findOne({ status: "pending" }).sort({ createdAt: -1 });

    if (interval) {
        interval.status = "completed";
        await interval.save();
    }

    // Get correct week start and end dates
    const { firstDayOfWeek, lastDayOfWeek } = getCurrentWeekEndDate();

    const newInterval = new intervalModel({
        current_interval_start: firstDayOfWeek,
        current_interval_end: lastDayOfWeek,
        current_intervel: getCurrentWeekDates(),
    });

    await newInterval.save();
    await intervalHandle();
};



//---------------Test api Function---------
const intervalInvestmentHandle=async(req,res)=>{
    try {
        await handleInterval()
        res.status(200).json({ msg: 'Interval investment handling completed successfully' });
    } catch (error) {
        console.log(error);
        res.status(500).json({ errMsg: 'Server side error', error: error.message });
    }
}

module.exports = {
    intervalInvestmentHandle,
    handleInterval
};


