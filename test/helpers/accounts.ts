import {User} from './user'

const resolverEOAPrivateKey = Buffer.from(
    '5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
    'hex'
)

const userAPrivateKey = Buffer.from(
    '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    'hex'
)

const userBPrivateKey = Buffer.from(
    '7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
    'hex'
)

export function createUsers(): User[] {
    return [
        new User(resolverEOAPrivateKey),
        new User(userAPrivateKey),
        new User(userBPrivateKey)
    ]
}
