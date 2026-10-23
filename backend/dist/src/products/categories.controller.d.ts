import { ProductsService } from './products.service';
import { Category } from './category.entity';
export declare class CategoriesController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    findAll(): Promise<Category[]>;
    findOne(id: string): Promise<Category>;
    create(body: Partial<Category>): Promise<Category>;
    update(id: string, body: Partial<Category>): Promise<Category>;
    delete(id: string): Promise<Category>;
}
