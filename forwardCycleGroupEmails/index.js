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
/*
Based on:
https://github.com/arithmetric/aws-lambda-ses-forwarder
https://github.com/AshanFernando/SESEmailForward
https://github.com/sirceljm/AWS-SES-simple-mail-forward


https://aws.amazon.com/blogs/messaging-and-targeting/forward-incoming-email-to-an-external-destination/
*/
async function readMessageFromS3(messageId) {
    const emailS3KeyPath = `/info/{messageId}`;
    const bucketName = 'email-stokegabrielcyclepath-org-uk';
    const s3Client = new aws.S3();
    const getObjectOutput = await s3Client.getObject({ Bucket: bucketName, Key: emailS3KeyPath }).promise();
    if (!getObjectOutput.Body) {
        return Promise.reject(new Error(`Error: getObjectOutput.Body undefined '${JSON.stringify(getObjectOutput)}'`));
    }
    const emailBody = getObjectOutput.Body.toString('utf8');
    return emailBody;
}
async function sendMessage(message, sender) {
    const params = {
        RawMessage: { Data: message },
        Destinations: ["nick.ager@gmail.com"],
        Source: sender
    };
    return new aws.SES().sendRawEmail(params).promise();
}
exports.handler = async (event, context) => {
    const headers = event.Records[0].ses.mail.headers;
    const spamVerdict = headers.find(header => header.name == "X-SES-Spam-Verdict");
    const virusVerdict = headers.find(header => header.name == "X-SES-Virus-Verdict");
    if (event.Records.length == 0 || event.Records[0].eventSource !== "aws:ses" ||
        spamVerdict === undefined || spamVerdict.value !== 'PASS' ||
        virusVerdict == undefined || virusVerdict.value !== 'PASS') {
        return Promise.reject(new Error(`Error: Received invalid SES message: '${JSON.stringify(event)}', spamVerdict = ${spamVerdict === undefined ? 'undefined' : spamVerdict.value}, virusVerdict = ${virusVerdict === undefined ? 'undefined' : virusVerdict.value}`));
    }
    const record = event.Records[0];
    const messageId = record.ses.mail.messageId;
    const sender = record.ses.mail.source;
    // const subject = record.ses.mail.commonHeaders.subject
    var message = await readMessageFromS3(messageId);
    message = message.replace(/^DKIM-Signature/im, "X-Original-DKIM-Signature");
    message = message.replace(/^From/im, "X-Original-From");
    message = message.replace(/^Source/im, "X-Original-Source");
    message = message.replace(/^Sender/im, "X-Original-Sender");
    message = message.replace(/^Return-Path/im, "X-Original-Return-Path");
    message = message.replace(/^Domainkey-Signature/im, "X-Original-Domainkey-Signature");
    await sendMessage(message, sender);
    return;
};
