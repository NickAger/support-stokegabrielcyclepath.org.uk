Based on: https://aws.amazon.com/blogs/messaging-and-targeting/forward-incoming-email-to-an-external-destination/

SES type definitions available at: https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/aws-lambda/trigger/ses.d.ts

Initialise Node:
```
npm init --yes
```

Install typescript and type definitions:
```
$ npm install --save-dev typescript
$ npm install --save-dev tsc-watch
$ npm install --save-dev @types/node
$ npm install --save-dev @types/aws-lambda
```

 Install AWS
 ```
 $ npm install aws-sdk # "aws-sdk provides its own type definitions, so you don't need to install @types/aws-sdk"
 ```
 
 Watch the compilation
 ```
 tsc --watch
 ```