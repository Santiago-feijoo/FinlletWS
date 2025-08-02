const DailyBalanceModel = require("./DailyBalanceModel");
const MotionModel = require("./MotionModel");
const TransactionModel = require("./TransactionModel");

class PaymentRegisteredModel {
    /**
    * @type {DailyBalanceModel|null}
    */
    dailyBalance;

    /**
    * @type {MotionModel|null}
    */
    movement;

    /**
    * @type {TransactionModel|null}
    */
    transaction;

}

module.exports = PaymentRegisteredModel;