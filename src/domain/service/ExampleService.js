export const NO_ROLES_EXCEPTION = "No roles configured";

export class ExampleService {

    constructor(repository) {
        this.roles = repository.getRoles()
    }

    getExample = () => {

        const role = this.roles[Math.floor(Math.random() * this.roles.length)];
        if(!role)
            throw NO_ROLES_EXCEPTION;

        return {
            name: "John Connor",
            levels: role.levels,
            tags:  [],
            roleKey: role.key
        }
    }

}