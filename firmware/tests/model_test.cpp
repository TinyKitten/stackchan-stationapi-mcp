#include "route_model.h"
#include <cassert>
#include <fstream>
#include <iterator>
#include <iostream>
int main(int argc, char** argv) {
    assert(argc == 2);
    std::ifstream input(argv[1]);
    std::string data((std::istreambuf_iterator<char>(input)), {});
    route_ui::Route route;
    assert(route_ui::Parse(data, route));
    assert(route.legs.size() == 2 && route.minutes == 25);
    assert(route.legs[0].from == "光が丘" && route.legs[1].to == "池袋");
    assert(route.legs[0].color == 0xB6007A);
    auto reject = [&](std::string invalid) {
        assert(!route_ui::Parse(invalid, route));
        assert(route.legs.size() == 2 && route.legs[0].from == "光が丘");
    };
    reject(""); reject(data + "garbage"); reject(data.substr(0, data.size()-1));
    reject(std::string(16385, ' '));
    reject(std::string(100, '[') + std::string(100, ']'));
    for (auto replacement : {"-1", "1.5", "100000", "1e999", "\"25\""}) {
        auto invalid = data; auto pos = invalid.find("\"minutes\":25");
        invalid.replace(pos, 12, std::string("\"minutes\":") + replacement); reject(invalid);
    }
    for (const auto& name : std::vector<std::string>{"", "a\\u0000b", "a\\nb", "a\\u007fb", std::string(257,'a')}) {
        auto invalid = data; invalid.replace(invalid.find("光が丘"), std::strlen("光が丘"), name); reject(invalid);
    }
    auto invalid = data; invalid.replace(invalid.find("B6007A"), 6, "zzzzzz"); reject(invalid);
    for (int n : {1, 2, 30}) {
        int page = 0;
        for (int i = 1; i <= n; ++i) { page=route_ui::Next(page,n); assert(page==i); }
        assert(route_ui::Next(page,n)==0);
        for (int i = n-1; i >= 0; --i) { page=route_ui::Previous(page); assert(page==i); }
    }
    std::cout << "Route parser and navigation passed\n";
}
