const JSONbig = require('json-bigint');

module.exports = {
    convertReceiptRequestToProto: function(str, cashboxId) {
        let receiptRequest = JSONbig.parse(str);

        receiptRequest.ftCashBoxID = cashboxId;
        receiptRequest.ftReceiptCase = receiptRequest.ftReceiptCase.toString();
        receiptRequest.cbReceiptMoment = this.convertJsDatetimeToProto(receiptRequest.cbReceiptMoment);
        receiptRequest.cbReceiptAmount = this.convertJsDecimalToProto(receiptRequest.cbReceiptAmount);
        receiptRequest.cbChargeItems.forEach(chargeItem => {
            chargeItem.Quantity = this.convertJsDecimalToProto(chargeItem.Quantity);
            chargeItem.Amount = this.convertJsDecimalToProto(chargeItem.Amount);
            chargeItem.VATRate = this.convertJsDecimalToProto(chargeItem.VATRate);
            chargeItem.VATAmount = this.convertJsDecimalToProto(chargeItem.VATAmount);
            chargeItem.UnitQuantity = this.convertJsDecimalToProto(chargeItem.UnitQuantity);
            chargeItem.Moment = this.convertJsDatetimeToProto(chargeItem.Moment);
            chargeItem.ftChargeItemCase = chargeItem.ftChargeItemCase.toString();
        });
        receiptRequest.cbPayItems.forEach(payItem => {
            payItem.Quantity = this.convertJsDecimalToProto(payItem.Quantity);
            payItem.Amount = this.convertJsDecimalToProto(payItem.Amount);
            payItem.Moment = this.convertJsDatetimeToProto(payItem.Moment);
            payItem.ftPayItemCase = payItem.ftPayItemCase.toString();
        });

        return receiptRequest;
    },
    convertJsDatetimeToProto: function (datetime) {
        if (!datetime) return undefined;

        return { value: new Date(datetime).getTime(), scale: 4, kind: 2 };
    },
    convertJsDecimalToProto: function (dec) {
        if (!dec) return undefined;

        // TODO: Replace this workaround with a proper serialization and also include the HI bits, instead of just cutting after 15 characters
        let decStr = dec.toString().replace("-", "").substring(0, 15);
        let split = decStr.split(".");
        let precision = split.length == 2 ? split[1].length || 0 : 0;
        let shift = dec.toString().startsWith("-") ? 0 : 1;

        return { lo: decStr.replace('.', ''), hi: 0, signScale: precision << shift };
    }
};