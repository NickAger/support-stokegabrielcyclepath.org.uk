import * as aws from "aws-sdk";
import { SESEvent, Context, Handler } from "aws-lambda";

/*
Based on:
https://github.com/arithmetric/aws-lambda-ses-forwarder
https://github.com/AshanFernando/SESEmailForward
https://github.com/sirceljm/AWS-SES-simple-mail-forward


https://aws.amazon.com/blogs/messaging-and-targeting/forward-incoming-email-to-an-external-destination/
*/


export const handler = async (event: SESEvent, context: Context): Promise<void> => {
    if (event.Records.length === 0) {
        return Promise.reject(new Error(`Error: Received invalid SES message with no Records: '${JSON.stringify(event)}'`))
    }
    const record = event.Records[0]
    const headers = record.ses.mail.headers
    const spamVerdict = headers.find(header=>header.name == "X-SES-Spam-Verdict")
    const virusVerdict = headers.find(header=>header.name == "X-SES-Virus-Verdict")

    if (record.eventSource !== "aws:ses" ||
        spamVerdict === undefined || spamVerdict.value !== 'PASS' || 
        virusVerdict == undefined || virusVerdict.value !== 'PASS') {
        return Promise.reject(new Error(`Error: Received invalid SES message with no Records: '${JSON.stringify(event)}', spamVerdict = ${spamVerdict === undefined ? 'undefined' : spamVerdict.value}, virusVerdict = ${virusVerdict === undefined ? 'undefined' : virusVerdict.value}`))
    }

    const messageId = record.ses.mail.messageId
    const sender = record.ses.mail.source

    var message = await readMessageFromS3(messageId)
    const reformattedMessage = prepareMessageForForwarding(message, sender)

    await sendMessage(reformattedMessage)
    return
}

async function readMessageFromS3(messageId: String): Promise<String> {
    const emailS3KeyPath = `info/${messageId}`
    const bucketName = 'email-stokegabrielcyclepath-org-uk'

    debugLog(`About to read from bucket: ${bucketName}, path: ${emailS3KeyPath}`)
    const s3Client = new aws.S3()
    const getObjectOutput = await s3Client.getObject({Bucket: bucketName, Key: emailS3KeyPath}).promise()
    if (!getObjectOutput.Body) {
        return Promise.reject(new Error(`Error: getObjectOutput.Body undefined '${JSON.stringify(getObjectOutput)}'`))
    }
    const emailBody = getObjectOutput.Body.toString('utf8')
    return emailBody
}

function prepareMessageForForwarding(message: String, sender: String) : String {
    message = message.replace(/^DKIM-Signature/im, "X-Original-DKIM-Signature")
    message = message.replace(/^From/im, "X-Original-From");
    message = message.replace(/^Source/im, "X-Original-Source");
    message = message.replace(/^Sender/im, "X-Original-Sender");
    message = message.replace(/^Return-Path/im, "X-Original-Return-Path");
    message = message.replace(/^Domainkey-Signature/im, "X-Original-Domainkey-Signature");
    message = `From: ${sender} forwarded from <info@stokegabrielcyclepath.org.uk>\r\nReply-To: ${sender}\r\n` + message
    return message
}

async function sendMessage(message: String) : Promise<aws.SES.SendEmailResponse> {
    const params : aws.SES.SendRawEmailRequest = {
        RawMessage: { Data: message },
        Destinations: [ "nick.ager@gmail.com", "martin.oldridge@gmail.com" ],
        Source: "info@stokegabrielcyclepath.org.uk"
    }

    debugLog(`About to send message using SES, message: ${message}`)
    return new aws.SES().sendRawEmail(params).promise()
}

// see: https://stackoverflow.com/questions/45194598/using-process-env-in-typescript
declare var process : {
    env: {
        DEBUGGING_ENABLED: string
    }
}

function debugLog(...data: any[]) {
    if (process.env.DEBUGGING_ENABLED === "ENABLED") {
        console.log(data)
    }
}