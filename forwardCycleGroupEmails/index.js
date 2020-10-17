"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const aws = __importStar(require("aws-sdk"));
exports.handler = async (event, context) => {
    if (event.Records.length === 0) {
        return Promise.reject(new Error(`Error: Received invalid SES message with no Records: '${JSON.stringify(event)}'`));
    }
    const record = event.Records[0];
    const headers = record.ses.mail.headers;
    const spamVerdict = headers.find(header => header.name == "X-SES-Spam-Verdict");
    const virusVerdict = headers.find(header => header.name == "X-SES-Virus-Verdict");
    if (record.eventSource !== "aws:ses" ||
        spamVerdict === undefined || spamVerdict.value !== 'PASS' ||
        virusVerdict == undefined || virusVerdict.value !== 'PASS') {
        return Promise.reject(new Error(`Error: Received invalid SES message with no Records: '${JSON.stringify(event)}', spamVerdict = ${spamVerdict === undefined ? 'undefined' : spamVerdict.value}, virusVerdict = ${virusVerdict === undefined ? 'undefined' : virusVerdict.value}`));
    }
    const messageId = record.ses.mail.messageId;
    const sender = record.ses.mail.source;
    var message = await readMessageFromS3(messageId);
    const reformattedMessage = prepareMessageForForwarding(message, sender);
    await sendMessage(reformattedMessage);
    return;
};
async function readMessageFromS3(messageId) {
    const emailS3KeyPath = `info/${messageId}`;
    const bucketName = 'email-stokegabrielcyclepath-org-uk';
    debugLog(`About to read from bucket: ${bucketName}, path: ${emailS3KeyPath}`);
    const s3Client = new aws.S3();
    const getObjectOutput = await s3Client.getObject({ Bucket: bucketName, Key: emailS3KeyPath }).promise();
    if (!getObjectOutput.Body) {
        return Promise.reject(new Error(`Error: getObjectOutput.Body undefined '${JSON.stringify(getObjectOutput)}'`));
    }
    const emailBody = getObjectOutput.Body.toString('utf8');
    return emailBody;
}
function prepareMessageForForwarding(message, sender) {
    message = message.replace(/^DKIM-Signature/im, "X-Original-DKIM-Signature");
    message = message.replace(/^From/im, "X-Original-From");
    message = message.replace(/^Source/im, "X-Original-Source");
    message = message.replace(/^Sender/im, "X-Original-Sender");
    message = message.replace(/^Return-Path/im, "X-Original-Return-Path");
    message = message.replace(/^Domainkey-Signature/im, "X-Original-Domainkey-Signature");
    message = `From: ${sender} forwarded from <info@stokegabrielcyclepath.org.uk>\r\nReply-To: ${sender}\r\n` + message;
    return message;
}
async function sendMessage(message) {
    const params = {
        RawMessage: { Data: message },
        Destinations: ["nick.ager@gmail.com"],
        Source: "info@stokegabrielcyclepath.org.uk"
    };
    debugLog(`About to send message using SES, message: ${message}`);
    return new aws.SES().sendRawEmail(params).promise();
}
function debugLog(...data) {
    if (process.env.DEBUGGING_ENABLED === "ENABLED") {
        console.log(data);
    }
}
